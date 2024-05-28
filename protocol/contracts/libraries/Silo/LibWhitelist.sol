/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {C} from "../../C.sol";
import {LibAppStorage} from "../LibAppStorage.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {AssetSettings} from "contracts/beanstalk/storage/System.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {LibWell, IWell} from "contracts/libraries/Well/LibWell.sol";
import {LibRedundantMath32} from "contracts/libraries/LibRedundantMath32.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/**
 * @title LibWhitelist
 * @author Publius
 * @notice Handles adding and removing ERC-20 tokens from the Silo Whitelist.
 */
library LibWhitelist {
    using LibRedundantMath32 for uint32;
    using SafeCast for int32;

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
     * @notice Emitted when a token is removed from the Silo Whitelist.
     * @param token ERC-20 token being removed from the Silo Whitelist.
     */
    event DewhitelistToken(address indexed token);

    /**
     * @dev Adds an ERC-20 token to the Silo Whitelist.
     */
    function whitelistToken(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // verify the BDV, gaugePoint, and liquidityWeight selector.
        verifyBDVselector(token, encodeType, selector);
        verifyGaugePointSelector(gaugePointSelector);
        verifyLiquidityWeightSelector(liquidityWeightSelector);

        // add whitelist status
        LibWhitelistedTokens.addWhitelistStatus(
            token,
            true, // Whitelisted by default.
            token != address(C.bean()) && !LibUnripe.isUnripe(token), // Assumes tokens that are not Unripe and not Bean are LP tokens.
            selector == LibWell.WELL_BDV_SELECTOR,
            selector == LibWell.WELL_BDV_SELECTOR // Assumes wells are soppable if selector is WELL_BDV_SELECTOR
        );

        // If an LP token, initialize oracle storage variables.
        if (token != address(C.bean()) && !LibUnripe.isUnripe(token)) {
            s.sys.usdTokenPrice[token] = 1;
            s.sys.twaReserves[token].reserve0 = 1;
            s.sys.twaReserves[token].reserve1 = 1;
        }

        require(
            s.sys.silo.assetSettings[token].milestoneSeason == 0,
            "Whitelist: Token already whitelisted"
        );
        // beanstalk requires all whitelisted assets to have a minimum stalkEarnedPerSeeason
        // of 1 (due to the germination update). set stalkEarnedPerSeason to 1 to prevent revert.
        if (stalkEarnedPerSeason == 0) stalkEarnedPerSeason = 1;
        s.sys.silo.assetSettings[token].selector = selector;
        s.sys.silo.assetSettings[token].stalkEarnedPerSeason = stalkEarnedPerSeason;
        s.sys.silo.assetSettings[token].stalkIssuedPerBdv = stalkIssuedPerBdv;
        s.sys.silo.assetSettings[token].milestoneSeason = uint32(s.sys.season.current);
        s.sys.silo.assetSettings[token].encodeType = encodeType;
        s.sys.silo.assetSettings[token].gpSelector = gaugePointSelector;
        s.sys.silo.assetSettings[token].lwSelector = liquidityWeightSelector;
        s.sys.silo.assetSettings[token].gaugePoints = gaugePoints;
        s.sys.silo.assetSettings[token].optimalPercentDepositedBdv = optimalPercentDepositedBdv;

        emit WhitelistToken(
            token,
            selector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            gaugePointSelector,
            liquidityWeightSelector,
            gaugePoints,
            optimalPercentDepositedBdv
        );
    }

    /**
     * @notice Updates optimalPercentDepositedBdv token.
     * @dev {LibWhitelistedTokens} must be updated to include the new token.
     */
    function updateOptimalPercentDepositedBdvForToken(
        address token,
        uint64 optimalPercentDepositedBdv
    ) internal {
        AssetSettings storage ss = LibAppStorage.diamondStorage().sys.silo.assetSettings[token];
        updateGaugeForToken(token, ss.gpSelector, ss.lwSelector, optimalPercentDepositedBdv);
    }

    /**
     * @notice Updates gauge settings for token.
     * @dev {LibWhitelistedTokens} must be updated to include the new token.
     */
    function updateGaugeForToken(
        address token,
        bytes4 gaugePointSelector,
        bytes4 liquidityWeightSelector,
        uint64 optimalPercentDepositedBdv
    ) internal {
        AssetSettings storage ss = LibAppStorage.diamondStorage().sys.silo.assetSettings[token];
        require(ss.selector != 0, "Whitelist: Token not whitelisted in Silo");
        verifyGaugePointSelector(gaugePointSelector);
        verifyLiquidityWeightSelector(liquidityWeightSelector);

        ss.gpSelector = gaugePointSelector;
        ss.lwSelector = liquidityWeightSelector;
        ss.optimalPercentDepositedBdv = optimalPercentDepositedBdv;

        emit UpdateGaugeSettings(
            token,
            gaugePointSelector,
            liquidityWeightSelector,
            optimalPercentDepositedBdv
        );
    }

    /**
     * @dev Updates the Stalk per BDV per Season for a token.
     */
    function updateStalkPerBdvPerSeasonForToken(
        address token,
        uint32 stalkEarnedPerSeason
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        require(s.sys.silo.assetSettings[token].milestoneSeason != 0, "Token not whitelisted");

        // beanstalk requires a min. stalkEarnedPerSeason of 1.
        if (stalkEarnedPerSeason == 0) stalkEarnedPerSeason = 1;

        // update milestone stem and season.
        s.sys.silo.assetSettings[token].milestoneStem = LibTokenSilo.stemTipForToken(token);
        s.sys.silo.assetSettings[token].milestoneSeason = s.sys.season.current;

        // stalkEarnedPerSeason is set to int32 before casting down.
        s.sys.silo.assetSettings[token].deltaStalkEarnedPerSeason = (int32(stalkEarnedPerSeason) -
            int32(s.sys.silo.assetSettings[token].stalkEarnedPerSeason)).toInt24();
        s.sys.silo.assetSettings[token].stalkEarnedPerSeason = stalkEarnedPerSeason;

        emit UpdatedStalkPerBdvPerSeason(token, stalkEarnedPerSeason, s.sys.season.current);
    }

    /**
     * @notice Removes an ERC-20 token from the Silo Whitelist.
     *
     */
    function dewhitelistToken(address token) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // before dewhitelisting, verify that `libWhitelistedTokens` are updated.
        LibWhitelistedTokens.updateWhitelistStatus(token, false, false, false, false);

        // set the stalkEarnedPerSeason to 1 and update milestone stem.
        // stalkEarnedPerSeason requires a min value of 1.
        updateStalkPerBdvPerSeasonForToken(token, 1);

        // delete the selector and encodeType.
        delete s.sys.silo.assetSettings[token].selector;
        delete s.sys.silo.assetSettings[token].encodeType;

        // delete gaugePoints, gaugePointSelector, liquidityWeightSelector, and optimalPercentDepositedBdv.
        delete s.sys.silo.assetSettings[token].gaugePoints;
        delete s.sys.silo.assetSettings[token].gpSelector;
        delete s.sys.silo.assetSettings[token].lwSelector;
        delete s.sys.silo.assetSettings[token].optimalPercentDepositedBdv;

        emit DewhitelistToken(token);
    }

    /**
     * @notice Verifies whether the bdv selector is valid.
     */
    function verifyBDVselector(address token, bytes1 encodeType, bytes4 selector) internal view {
        (bool success, ) = address(this).staticcall(
            LibTokenSilo.encodeBdvFunction(token, encodeType, selector, 0)
        );
        require(success, "Whitelist: Invalid BDV selector");
    }

    /**
     * @notice Verifies whether the gaugePointSelector is valid for the gauge system.
     */
    function verifyGaugePointSelector(bytes4 selector) internal view {
        // verify you passed in a callable gaugePoint selector
        (bool success, ) = address(this).staticcall(abi.encodeWithSelector(selector, 0, 0, 0));
        require(success, "Whitelist: Invalid GaugePoint selector");
    }

    /**
     * @notice Verifies whether the selector is valid for the gauge system.
     */
    function verifyLiquidityWeightSelector(bytes4 selector) internal view {
        // verify you passed in a callable liquidityWeight selector
        (bool success, ) = address(this).staticcall(abi.encodeWithSelector(selector));
        require(success, "Whitelist: Invalid LiquidityWeight selector");
    }
}
