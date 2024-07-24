/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {LibTractor} from "contracts/libraries/LibTractor.sol";
import "contracts/libraries/Silo/LibSilo.sol";
import "contracts/libraries/Silo/LibTokenSilo.sol";
import "contracts/libraries/LibRedundantMath32.sol";
import "../ReentrancyGuard.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";

/**
 * @author Publius
 * @title Enroot Facet handles enrooting Update Deposits
 **/
contract EnrootFacet is Invariable, ReentrancyGuard {
    using LibRedundantMath256 for uint256;
    using SafeCast for uint256;

    event RemoveDeposit(
        address indexed account,
        address indexed token,
        int96 stem,
        uint256 amount,
        uint256 bdv
    );

    event RemoveDeposits(
        address indexed account,
        address indexed token,
        int96[] stems,
        uint256[] amounts,
        uint256 amount,
        uint256[] bdvs
    );

    /**
     * @notice EnrootData is a struct that holds data needed for enrooting a token.
     */
    struct EnrootData {
        uint256 newTotalBdv;
        uint256 totalAmountRemoved;
        uint256 stalkAdded;
        uint256 bdvAdded;
        int96 stemTip;
        uint32 stalkPerBdv;
    }

    modifier mowSender(address token) {
        LibSilo._mow(LibTractor._user(), token);
        _;
    }

    //////////////////////// UPDATE UNRIPE DEPOSITS ////////////////////////

    /**
     * @notice Update the BDV of an Unripe Deposit. Allows the user to claim
     * Stalk as the BDV of Unripe tokens increases during the Barn
     * Raise. This was introduced as a part of the Replant.
     *
     * @dev Should revert if `ogBDV > newBDV`. A user cannot lose BDV during an
     * Enroot operation.
     *
     * Gas optimization: We neglect to check if `token` is whitelisted. If a
     * token is not whitelisted, it cannot be Deposited, and thus cannot be Removed.
     *
     * {LibTokenSilo-removeDepositFromAccount} should revert if there isn't
     * enough balance of `token` to remove.
     * Because the amount and the stem of an Deposit does not change,
     * an ERC1155 event does not need to be emitted.
     *
     */
    function enrootDeposit(
        address token,
        int96 stem,
        uint256 amount
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant mowSender(token) {
        require(
            s.sys.silo.unripeSettings[token].underlyingToken != address(0),
            "Silo: token not unripe"
        );

        uint256 deltaBDV;
        {
            // remove Deposit and Redeposit with new BDV
            uint256 ogBDV = LibTokenSilo.removeDepositFromAccount(
                LibTractor._user(),
                token,
                stem,
                amount
            );

            // Remove Deposit does not emit an event, while Add Deposit does.
            emit RemoveDeposit(LibTractor._user(), token, stem, amount, ogBDV);

            // Calculate the current BDV for `amount` of `token` and add a Deposit.
            uint256 newBDV = LibTokenSilo.beanDenominatedValue(token, amount);

            LibTokenSilo.addDepositToAccount(
                LibTractor._user(),
                token,
                stem,
                amount,
                newBDV,
                LibTokenSilo.Transfer.noEmitTransferSingle
            ); // emits AddDeposit event

            // Calculate the difference in BDV. Reverts if `ogBDV > newBDV`.
            deltaBDV = newBDV.sub(ogBDV);
        }

        LibTokenSilo.incrementTotalDepositedBdv(token, deltaBDV);

        // enroots should mint active stalk,
        // as unripe assets have been in the system for at least 1 season.
        uint256 deltaStalk = deltaBDV.mul(s.sys.silo.assetSettings[token].stalkIssuedPerBdv).add(
            LibSilo.stalkReward(stem, LibTokenSilo.stemTipForToken(token), uint128(deltaBDV))
        );

        LibSilo.mintActiveStalk(LibTractor._user(), deltaStalk.toUint128());
    }

    /**
     * @notice Update the BDV of Unripe Deposits. Allows the user to claim Stalk
     * as the BDV of Unripe tokens increases during the Barn Raise.
     * This was introduced as a part of the Replant.
     *
     * @dev Should revert if `ogBDV > newBDV`. A user cannot lose BDV during an
     * Enroot operation.
     *
     * Gas optimization: We neglect to check if `token` is whitelisted. If a
     * token is not whitelisted, it cannot be Deposited, and thus cannot be Removed.
     * {removeDepositsFromAccount} should revert if there isn't enough balance of `token`
     * to remove.
     */
    function enrootDeposits(
        address token,
        int96[] calldata stems,
        uint256[] calldata amounts
    ) external payable fundsSafu noNetFlow noSupplyChange nonReentrant mowSender(token) {
        require(
            s.sys.silo.unripeSettings[token].underlyingToken != address(0),
            "Silo: token not unripe"
        );
        // First, remove Deposits because every deposit is in a different season,
        // we need to get the total Stalk, not just BDV.
        LibSilo.AssetsRemoved memory ar = LibSilo._removeDepositsFromAccount(
            LibTractor._user(),
            token,
            stems,
            amounts,
            LibSilo.ERC1155Event.NO_EMIT_BATCH_EVENT
        );

        // Get enroot data.
        EnrootData memory enrootData = _getTokenEnrootData(token, ar);

        // Iterate through all stems, redeposit the tokens with new BDV and
        // summate new Stalk.
        for (uint256 i; i < stems.length; ++i) {
            uint256 depositBdv;
            if (i + 1 == stems.length) {
                // Ensure that a rounding error does not occur by using the
                // remainder BDV for the last Deposit
                depositBdv = enrootData.newTotalBdv.sub(enrootData.bdvAdded);
            } else {
                // depositBdv is a proportional amount of the total bdv.
                // Cheaper than calling the BDV function multiple times.
                depositBdv = amounts[i].mul(enrootData.newTotalBdv).div(
                    enrootData.totalAmountRemoved
                );
            }

            enrootData.stalkAdded = enrootData.stalkAdded.add(
                addDepositAndCalculateStalk(
                    token,
                    stems[i],
                    amounts[i],
                    depositBdv,
                    enrootData.stemTip,
                    enrootData.stalkPerBdv
                )
            );

            enrootData.bdvAdded = enrootData.bdvAdded.add(depositBdv);
        }

        // increment bdv and mint stalk.
        // bdv and stalk from enrooting does not germinate
        // given that the assets are unripe.
        // reverts if bdvAdded < bdvRemoved.
        LibTokenSilo.incrementTotalDepositedBdv(
            token,
            enrootData.bdvAdded.sub(ar.active.bdv.add(ar.even.bdv).add(ar.odd.bdv))
        );
        LibSilo.mintActiveStalk(
            LibTractor._user(),
            enrootData.stalkAdded.sub(
                ar.active.stalk.add(ar.even.stalk).add(ar.odd.stalk).add(
                    ar.grownStalkFromGermDeposits
                )
            )
        );
    }

    /**
     * @notice Gets data needed for enrooting a token.
     * @dev placed outside for stack overflow reasons.
     */
    function _getTokenEnrootData(
        address token,
        LibSilo.AssetsRemoved memory ar
    ) private view returns (EnrootData memory enrootData) {
        // get the new total bdv.
        enrootData.newTotalBdv = LibTokenSilo.beanDenominatedValue(
            token,
            ar.active.tokens.add(ar.odd.tokens).add(ar.even.tokens)
        );
        // summate the total amount removed.
        enrootData.totalAmountRemoved = ar.active.tokens.add(ar.odd.tokens).add(ar.even.tokens);

        // get the stemTip and stalkPerBdv.
        enrootData.stemTip = LibTokenSilo.stemTipForToken(token);
        // get the stalk per BDV.
        enrootData.stalkPerBdv = s.sys.silo.assetSettings[token].stalkIssuedPerBdv;
    }

    /**
     * @notice Adds a deposit to the account and calculates the stalk added.
     * @dev Placed in a function for stack overflow reasons.
     */
    function addDepositAndCalculateStalk(
        address token,
        int96 stem,
        uint256 amount,
        uint256 bdv,
        int96 stemTip,
        uint32 stalkPerBdv
    ) private returns (uint256 stalkAdded) {
        LibTokenSilo.addDepositToAccount(
            LibTractor._user(),
            token,
            stem,
            amount,
            bdv,
            LibTokenSilo.Transfer.noEmitTransferSingle
        );

        return
            bdv.mul(stalkPerBdv).add(
                LibSilo.stalkReward(
                    stem,
                    stemTip,
                    uint128(bdv) // safeCast not needed because bdv is already uint128.
                )
            );
    }
}
