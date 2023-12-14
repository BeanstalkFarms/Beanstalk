/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "contracts/libraries/Silo/LibSilo.sol";
import "contracts/libraries/Silo/LibTokenSilo.sol";
import "./SiloFacet/Silo.sol";
import "contracts/libraries/LibSafeMath32.sol";
import "../ReentrancyGuard.sol";


/**
 * @author Publius
 * @title Enroot Facet handles enrooting Update Deposits
 **/
contract EnrootFacet is ReentrancyGuard {
    using SafeMath for uint256;

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
        uint256 stalkAdded;
        uint256 bdvAdded;
        uint32 stalkPerBdv;
        LibGerminate.GermStem germStem;
    }

    modifier mowSender(address token) {
       LibSilo._mow(msg.sender, token);
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
     */
    function enrootDeposit(
        address token,
        int96 stem,
        uint256 amount
    ) external payable nonReentrant mowSender(token) {
        require(s.u[token].underlyingToken != address(0), "Silo: token not unripe");
        
        // get germination state.
        (LibGerminate.Germinate germ, int96 stemTip) = LibGerminate.getGerminationState(token, stem);

        // remove Deposit and Redeposit with new BDV
        uint256 ogBDV = LibTokenSilo.removeDepositFromAccount(
            msg.sender,
            token,
            stem,
            amount,
            germ
        );
        // Remove Deposit does not emit an event, while Add Deposit does.
        emit RemoveDeposit(msg.sender, token, stem, amount, ogBDV); 

        // Calculate the current BDV for `amount` of `token` and add a Deposit.
        uint256 newBDV = LibTokenSilo.beanDenominatedValue(token, amount);

        LibTokenSilo.addDepositToAccount(
            msg.sender, 
            token, 
            stem, 
            amount, 
            newBDV,
            LibTokenSilo.Transfer.noEmitTransferSingle,
            germ
        ); // emits AddDeposit event

        // Calculate the difference in BDV. Reverts if `ogBDV > newBDV`.
        uint256 deltaBDV = newBDV.sub(ogBDV);
        LibTokenSilo.incrementTotalGerminatingBdv(token, deltaBDV, germ);

        // Mint Stalk associated with the new BDV.
        uint256 deltaStalk = deltaBDV.mul(s.ss[token].stalkIssuedPerBdv).add(
            LibSilo.stalkReward(stem, stemTip, uint128(deltaBDV))
        );

        LibSilo.mintStalk(msg.sender, deltaStalk, germ);
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
    ) external payable nonReentrant mowSender(token) {
        require(s.u[token].underlyingToken != address(0), "Silo: token not unripe");
        // First, remove Deposits because every deposit is in a different season,
        // we need to get the total Stalk, not just BDV.
        LibSilo.AssetsRemoved memory ar = LibSilo._removeDepositsFromAccount(msg.sender, token, stems, amounts);

        // Get enroot data.
        EnrootData memory enrootData = _getTokenEnrootData(token, ar);

        // Iterate through all stems, redeposit the tokens with new BDV and
        // summate new Stalk.
        for (uint256 i; i < stems.length; ++i) {
            uint256 depositBdv;
            if (i+1 == stems.length) {
                // Ensure that a rounding error does not occur by using the
                // remainder BDV for the last Deposit.
                depositBdv = enrootData.newTotalBdv.sub(enrootData.bdvAdded);
            } else {
                // depositBdv is a proportional amount of the total bdv.
                // Cheaper than calling the BDV function multiple times.
                depositBdv = amounts[i].mul(enrootData.newTotalBdv).div(
                    ar.tokensRemoved
                    .add(ar.oddTokensRemoved)
                    .add(ar.evenTokensRemoved)
                );
            }

            enrootData.stalkAdded = enrootData.stalkAdded.add(
                addDepositAndCalculateStalk(
                    token,
                    stems[i],
                    amounts[i],
                    depositBdv,
                    enrootData
                )
            );

            enrootData.bdvAdded = enrootData.bdvAdded.add(depositBdv);
        }

        // note: we include the germinating bdv and stalk
        // to get the change in stalk from enrooting.
        incrementTotalGerminatingBdvAndMintStalk(
            token,
            enrootData.bdvAdded.sub(
                ar.bdvRemoved
                .add(ar.evenBdvRemoved)
                .add(ar.oddBdvRemoved)
            ),
            enrootData.stalkAdded.sub(
                ar.stalkRemoved
                .add(ar.evenStalkRemoved)
                .add(ar.oddStalkRemoved)
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
        enrootData.newTotalBdv = LibTokenSilo.beanDenominatedValue(token, ar.bdvRemoved);
        enrootData.germStem = LibGerminate.getGerminatingStem(token);
        enrootData.stalkPerBdv = s.ss[token].stalkIssuedPerBdv;
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
        EnrootData memory enrootData
    ) private returns (uint256 stalkAdded) {
        LibTokenSilo.addDepositToAccount(
                msg.sender,
                token,
                stem,
                amount,
                bdv,
                LibTokenSilo.Transfer.noEmitTransferSingle,
                LibGerminate._getGerminationState(stem, enrootData.germStem)
            );

            return bdv.mul(enrootData.stalkPerBdv).add(
                LibSilo.stalkReward(
                    stem,
                    enrootData.germStem.stemTip,
                    uint128(bdv) // safeCast not needed because bdv is already uint128.
                )
            );
    }
    /**
     * @notice Increments total germinating bdv and mints germinating stalk,
     * allocated to the current season.
     * 
     * @dev Placed in an function for stack overflow reasons.
     * @param token The token to increment total germinating bdv for.
     * @param bdvChange The change in bdv from enrooting.
     * @param stalkChange The change in stalk from enrooting.
     */
    function incrementTotalGerminatingBdvAndMintStalk(
        address token,
        uint256 bdvChange,
        uint256 stalkChange
    ) private {
        LibGerminate.Germinate _germ = LibGerminate.getSeasonGerminationState();
        
        LibTokenSilo.incrementTotalGerminatingBdv(
            token, 
            bdvChange,
            _germ
        );

        LibSilo.mintStalk(
            msg.sender,
            stalkChange,
            _germ
        );
    }
}
