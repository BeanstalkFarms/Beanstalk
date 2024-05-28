/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import "contracts/beanstalk/silo/WhitelistFacet/WhitelistFacet.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";

/**
 * @author Brean
 * @title Mock Whitelist Facet
 **/
contract MockWhitelistFacet is WhitelistFacet {
    /**
     * @notice Emitted when a token is added to the Silo Whitelist.
     * @param token ERC-20 token being added to the Silo Whitelist.
     * @param selector The function selector that returns the BDV of a given token.
     * @param stalkEarnedPerSeason The Stalk per BDV per Season received from depositing `token`.
     * @param stalkIssuedPerBdv The Stalk per BDV given from depositing `token`.
     * @param gpSelector The function selector that returns the gauge points of a given token.
     * @param lwSelector The function selector that returns the liquidity weight of a given token.
     * @param gaugePoints The gauge points of the token.
     * @param optimalPercentDepositedBdv The target percentage
     * of the total LP deposited BDV for this token.
     */
    event WhitelistToken(
        address indexed token,
        bytes4 selector,
        uint32 stalkEarnedPerSeason,
        uint256 stalkIssuedPerBdv,
        bytes4 gpSelector,
        bytes4 lwSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    );

    /**
     * @notice Emitted when the gauge settings are updated.
     * @param token Token that is being updated.
     * @param gpSelector The new gaugePoint selector.
     * @param lwSelector The new liquidityWeight selector.
     * @param optimalPercentDepositedBdv The new optimal Percent deposited BDV
     */
    event UpdateGaugeSettings(
        address indexed token,
        bytes4 gpSelector,
        bytes4 lwSelector,
        uint64 optimalPercentDepositedBdv
    );

    /**
     * @notice Emitted when the stalk per bdv per season for a Silo token is updated.
     * @param token ERC-20 token being updated in the Silo Whitelist.
     * @param stalkEarnedPerSeason New stalk per bdv per season value for this token.
     * @param season The season that the new stalk per bdv per season value becomes active (The current season).
     */
    event UpdatedStalkPerBdvPerSeason(
        address indexed token,
        uint32 stalkEarnedPerSeason,
        uint32 season
    );

    /**
     * @notice Emitted when a Whitelis Status is added.
     */
    event AddWhitelistStatus(
        address token,
        uint256 index,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isSoppable
    );

    /**
     * @notice Emitted when a Whitelist Status is removed.
     */
    event RemoveWhitelistStatus(address token, uint256 index);

    /**
     * @notice Emitted when a Whitelist Status is updated.
     */
    event UpdateWhitelistStatus(
        address token,
        uint256 index,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    );

    /**
     * @notice Emitted when a token is removed from the Silo Whitelist.
     * @param token ERC-20 token being removed from the Silo Whitelist.
     */
    event DewhitelistToken(address indexed token);

    function updateWhitelistStatus(
        address token,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    ) external {
        LibWhitelistedTokens.updateWhitelistStatus(
            token,
            isWhitelisted,
            isWhitelistedLp,
            isWhitelistedWell,
            isSoppable
        );
    }

    function removeWhitelistStatus(address token) external {
        LibWhitelistedTokens.removeWhitelistStatus(token);
    }

    function addWhitelistStatus(
        address token,
        bool isWhitelisted,
        bool isWhitelistedLp,
        bool isWhitelistedWell,
        bool isSoppable
    ) external {
        LibWhitelistedTokens.addWhitelistStatus(
            token,
            isWhitelisted,
            isWhitelistedLp,
            isWhitelistedWell,
            isSoppable
        );
    }
}
