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
        // First, remove Deposit and Redeposit with new BDV
        uint256 ogBDV = LibTokenSilo.removeDepositFromAccount(
            msg.sender,
            token,
            stem,
            amount
        );
        emit RemoveDeposit(msg.sender, token, stem, amount, ogBDV); // Remove Deposit does not emit an event, while Add Deposit does.

        // Calculate the current BDV for `amount` of `token` and add a Deposit.
        uint256 newBDV = LibTokenSilo.beanDenominatedValue(token, amount);

        LibTokenSilo.addDepositToAccount(
            msg.sender, 
            token, 
            stem, 
            amount, 
            newBDV,
            LibTokenSilo.Transfer.noEmitTransferSingle
        ); // emits AddDeposit event

        // Calculate the difference in BDV. Reverts if `ogBDV > newBDV`.
        uint256 deltaBDV = newBDV.sub(ogBDV);
        LibTokenSilo.incrementTotalDepositedBdv(token, deltaBDV);

        // Mint Stalk associated with the new BDV.
        uint256 deltaStalk = deltaBDV.mul(s.ss[token].stalkIssuedPerBdv).add(
            LibSilo.stalkReward(stem,
                                LibTokenSilo.stemTipForToken(token),
                                uint128(deltaBDV))
        );

        LibSilo.mintStalk(msg.sender, deltaStalk);
    }

    modifier mowSender(address token) {
       LibSilo._mow(msg.sender, token);
        _;
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

        // Get new BDV
        uint256 newTotalBdv = LibTokenSilo.beanDenominatedValue(token, ar.tokensRemoved);
        uint256 stalkAdded; uint256 bdvAdded;

        //pulled these vars out because of "CompilerError: Stack too deep, try removing local variables."
        int96 _lastStem = LibTokenSilo.stemTipForToken(token); //need for present season
        uint32 _stalkPerBdv = s.ss[token].stalkIssuedPerBdv;

        uint256 depositBdv;

        // Iterate through all stems, redeposit the tokens with new BDV and
        // summate new Stalk.
        for (uint256 i; i < stems.length; ++i) {
            if (i+1 == stems.length) {
                // Ensure that a rounding error does not occur by using the
                // remainder BDV for the last Deposit.
                depositBdv = newTotalBdv.sub(bdvAdded);
            } else {
                // depositBdv is a proportional amount of the total bdv.
                // Cheaper than calling the BDV function multiple times.
                depositBdv = amounts[i].mul(newTotalBdv).div(ar.tokensRemoved);
            }
            LibTokenSilo.addDepositToAccount(
                msg.sender,
                token,
                stems[i],
                amounts[i],
                depositBdv,
                LibTokenSilo.Transfer.noEmitTransferSingle
            );
            
            stalkAdded = stalkAdded.add(
                depositBdv.mul(_stalkPerBdv).add(
                    LibSilo.stalkReward(
                        stems[i],
                        _lastStem,
                        uint128(depositBdv)
                    )
                )
            );

            bdvAdded = bdvAdded.add(depositBdv);
        }

        LibTokenSilo.incrementTotalDepositedBdv(token, bdvAdded.sub(ar.bdvRemoved));

        // Mint Stalk associated with the delta BDV.
        LibSilo.mintStalk(
            msg.sender,
            stalkAdded.sub(ar.stalkRemoved)
        );
    }
}
