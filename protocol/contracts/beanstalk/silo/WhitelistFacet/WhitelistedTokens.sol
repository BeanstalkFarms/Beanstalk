/*
 * SPDX-License-Identifier: MIT
 */

pragma solidity ^0.8.20;

import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {WhitelistStatus} from "contracts/beanstalk/storage/System.sol";

/**
 * @title WhitelistedTokens
 * @author Brendan
 * @notice Returns information related to WhitelistStatuses.
 */
contract WhitelistedTokens {
    /**
     * @notice Returns all tokens that have been whitelisted and has not had its Whitelist Status manually removed.
     * @dev includes Dewhitelisted tokens with existing Deposits.
     */
    function getSiloTokens() external view returns (address[] memory tokens) {
        return LibWhitelistedTokens.getSiloTokens();
    }

    /**
     * @notice Returns the current Whitelisted tokens, including Unripe tokens.
     */
    function getWhitelistedTokens() external view returns (address[] memory tokens) {
        return LibWhitelistedTokens.getWhitelistedTokens();
    }

    /**
     * @notice Returns the current Whitelisted LP tokens.
     * @dev Unripe LP is not an LP token.
     */
    function getWhitelistedLpTokens() external view returns (address[] memory tokens) {
        return LibWhitelistedTokens.getWhitelistedLpTokens();
    }

    /**
     * @notice Returns the current Whitelisted Well LP tokens.
     */
    function getWhitelistedWellLpTokens() external view returns (address[] memory tokens) {
        return LibWhitelistedTokens.getWhitelistedWellLpTokens();
    }

    /**
     * @notice Returns the Whitelist statues for all tokens with a non-zero Deposit.
     */
    function getWhitelistStatuses()
        external
        view
        returns (WhitelistStatus[] memory _whitelistStatuses)
    {
        return LibWhitelistedTokens.getWhitelistedStatuses();
    }

    /**
     * @notice Returns the Whitelist statu for a given Deposit.
     */
    function getWhitelistStatus(
        address token
    ) external view returns (WhitelistStatus memory _whitelistStatuses) {
        return LibWhitelistedTokens.getWhitelistedStatus(token);
    }
}
