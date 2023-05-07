/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "./TokenSilo.sol";
import "../../ReentrancyGuard.sol";
import "../../../libraries/Token/LibTransfer.sol";
import "../../../libraries/Silo/LibSiloPermit.sol";
import "../../../libraries/Silo/LibLegacyTokenSilo.sol";


contract LegacyClaimWithdrawalFacet is TokenSilo {
    /*
     * Claim
     */

    function claimWithdrawal(
        address token,
        uint32 season,
        LibTransfer.To mode
    ) external payable nonReentrant {
        uint256 amount = LibLegacyTokenSilo._claimWithdrawal(msg.sender, token, season);
        LibTransfer.sendToken(IERC20(token), amount, msg.sender, mode);
    }

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

    function getWithdrawal(
        address account,
        address token,
        uint32 season
    ) external view returns (uint256) {
        AppStorage storage s = LibAppStorage.diamondStorage();
        return s.a[account].withdrawals[token][season];
    }
}