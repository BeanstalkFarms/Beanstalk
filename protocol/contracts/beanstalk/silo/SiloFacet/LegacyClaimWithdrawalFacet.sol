/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "~/beanstalk/ReentrancyGuard.sol";
import "~/libraries/Token/LibTransfer.sol";
import "~/libraries/Silo/LibLegacyTokenSilo.sol";


/**
 * @author pizzaman1337, Publius
 * @title LegacyClaimWithdrawalFacet
 * @notice Claim and Read Withdrawals.
 * @dev Silo V3 removed the Withdrawal timer. Withdrawing now directly
 * sends ERC-20 tokens to the Farmer instead of creating a Withdrawal.
 * Although new Withdrawals cannot be created, the claim Withdrawal
 * functionality has been perserved by this facet to allow pre-existing
 * unclaimed Withdrawals to still be claimed.
 **/
contract LegacyClaimWithdrawalFacet is ReentrancyGuard {

    /*
     * Claim
     */

    /**
     * @notice Claims ERC20s from a Withdrawal.
     * @param token address of ERC20
     * @param season season to claim
     * @param mode destination of funds (INTERNAL, EXTERNAL, EXTERNAL_INTERNAL, INTERNAL_TOLERANT)
     */
    function claimWithdrawal(
        address token,
        uint32 season,
        LibTransfer.To mode
    ) external payable nonReentrant {
        uint256 amount = LibLegacyTokenSilo._claimWithdrawal(msg.sender, token, season);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }

    /**
     * @notice Claims ERC20s from multiple Withdrawals.
     * @param token address of ERC20
     * @param seasons array of seasons to claim
     * @param mode destination of funds (INTERNAL, EXTERNAL, EXTERNAL_INTERNAL, INTERNAL_TOLERANT)
     */
    function claimWithdrawals(
        address token,
        uint32[] calldata seasons,
        LibTransfer.To mode
    ) external payable nonReentrant {
        uint256 amount = LibLegacyTokenSilo._claimWithdrawals(msg.sender, token, seasons);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }

    /*
     * Getters
     */

    /**
     * @notice Get the amount of `token` in the Withdrawal `season` for `account`.
     */
    function getWithdrawal(
        address account,
        address token,
        uint32 season
    ) external view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].withdrawals[token][season];
    }

    /**
     * @notice Get the total amount of `token` currently Withdrawn from the Silo across all users.
     */
    function getTotalWithdrawn(address token) external view returns (uint256) {
        return s.siloBalances[token].withdrawn;
    }
}