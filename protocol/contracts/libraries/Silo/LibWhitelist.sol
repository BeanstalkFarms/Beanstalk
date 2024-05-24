/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {C} from "../../C.sol";
import {LibAppStorage, AppStorage, Storage} from "../LibAppStorage.sol";
import {LibTokenSilo} from "contracts/libraries/Silo/LibTokenSilo.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {LibWell, IWell} from "contracts/libraries/Well/LibWell.sol";
import {IChainlinkAggregator} from "contracts/interfaces/chainlink/IChainlinkAggregator.sol";
import {LibRedundantMath32} from "contracts/libraries/LibRedundantMath32.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {console} from "forge-std/console.sol";

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
     * @notice Emitted when a token is added to the Silo Whitelist with external implementation(s).
     */
    event WhitelistTokenWithExternalImplementation(
        Storage.Implementation oracleImplementation,
        Storage.Implementation gpImplementation,
        Storage.Implementation lwImplementation
    );

    /**
     * @notice Emitted when the oracle implementation for a token is updated.
     */
    event UpdatedOracleImplementationForToken(
        address indexed token,
        Storage.Implementation oracleImplementation
    );

    /**
     * @notice Emitted when the gauge point implementation for a token is updated.
     */
    event UpdatedGaugePointImplementationForToken(
        address indexed token,
        Storage.Implementation gaugePointImplementation
    );

    /**
     * @notice Emitted when the liquidity weight implementation for a token is updated.
     */
    event UpdatedLiqudityWeightImplementationForToken(
        address indexed token,
        Storage.Implementation liquidityWeightImplementation
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
            selector == LibWell.WELL_BDV_SELECTOR
        );

        // If an LP token, initialize oracle storage variables.
        if (token != address(C.bean()) && !LibUnripe.isUnripe(token)) {
            s.usdTokenPrice[token] = 1;
            s.twaReserves[token].reserve0 = 1;
            s.twaReserves[token].reserve1 = 1;
        }

        require(s.ss[token].milestoneSeason == 0, "Whitelist: Token already whitelisted");
        // beanstalk requires all whitelisted assets to have a minimum stalkEarnedPerSeeason
        // of 1 (due to the germination update). set stalkEarnedPerSeason to 1 to prevent revert.
        if (stalkEarnedPerSeason == 0) stalkEarnedPerSeason = 1;
        s.ss[token].selector = selector;
        s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason;
        s.ss[token].stalkIssuedPerBdv = stalkIssuedPerBdv;
        s.ss[token].milestoneSeason = uint32(s.season.current);
        s.ss[token].encodeType = encodeType;
        s.ss[token].gpSelector = gaugePointSelector;
        s.ss[token].lwSelector = liquidityWeightSelector;
        s.ss[token].gaugePoints = gaugePoints;
        s.ss[token].optimalPercentDepositedBdv = optimalPercentDepositedBdv;

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
     * @notice whitelists a token with an external implementation(s).
     */
    function whitelistTokenWithExternalImplementation(
        address token,
        bytes4 selector,
        uint32 stalkIssuedPerBdv,
        uint32 stalkEarnedPerSeason,
        bytes1 encodeType,
        uint128 gaugePoints,
        uint64 optimalPercentDepositedBdv,
        Storage.Implementation memory oracleImplementation,
        Storage.Implementation memory gpImplementation,
        Storage.Implementation memory lwImplementation
    ) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // verify the BDV, gaugePoint, and liquidityWeight selector.
        verifyBDVselector(token, encodeType, selector);
        verifyOracleImplementation(
            oracleImplementation.target,
            oracleImplementation.selector,
            oracleImplementation.encodeType
        );
        verifyGaugePointImplementation(gpImplementation.target, gpImplementation.selector);
        verifyLiquidityWeightImplementation(lwImplementation.target, lwImplementation.selector);

        // add whitelist status
        LibWhitelistedTokens.addWhitelistStatus(
            token,
            true, // Whitelisted by default.
            token != address(C.bean()) && !LibUnripe.isUnripe(token), // Assumes tokens that are not Unripe and not Bean are LP tokens.
            selector == LibWell.WELL_BDV_SELECTOR
        );

        // If an LP token, initialize oracle storage variables.
        if (token != address(C.bean()) && !LibUnripe.isUnripe(token)) {
            s.usdTokenPrice[token] = 1;
            s.twaReserves[token].reserve0 = 1;
            s.twaReserves[token].reserve1 = 1;
        }

        require(s.ss[token].milestoneSeason == 0, "Whitelist: Token already whitelisted");
        // beanstalk requires all whitelisted assets to have a minimum stalkEarnedPerSeeason
        // of 1 (due to the germination update). set stalkEarnedPerSeason to 1 to prevent revert.
        if (stalkEarnedPerSeason == 0) stalkEarnedPerSeason = 1;
        s.ss[token].selector = selector;
        s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason;
        s.ss[token].stalkIssuedPerBdv = stalkIssuedPerBdv;
        s.ss[token].milestoneSeason = uint32(s.season.current);
        s.ss[token].encodeType = encodeType;
        s.ss[token].gpSelector = bytes4(0);
        s.ss[token].lwSelector = bytes4(0);
        s.ss[token].gaugePoints = gaugePoints;
        s.ss[token].optimalPercentDepositedBdv = optimalPercentDepositedBdv;
        s.ss[token].gaugePointImplementation = gpImplementation;
        s.ss[token].liquidityWeightImplementation = lwImplementation;

        // the Oracle should return the price for the non-bean asset in USD
        s.oracleImplementation[token] = oracleImplementation;

        emit WhitelistToken(
            token,
            selector,
            stalkEarnedPerSeason,
            stalkIssuedPerBdv,
            bytes4(0),
            bytes4(0),
            gaugePoints,
            optimalPercentDepositedBdv
        );

        emit WhitelistTokenWithExternalImplementation(
            oracleImplementation,
            gpImplementation,
            lwImplementation
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
        Storage.SiloSettings storage ss = LibAppStorage.diamondStorage().ss[token];
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
        Storage.SiloSettings storage ss = LibAppStorage.diamondStorage().ss[token];
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

        require(s.ss[token].milestoneSeason != 0, "Token not whitelisted");

        // beanstalk requires a min. stalkEarnedPerSeason of 1.
        if (stalkEarnedPerSeason == 0) stalkEarnedPerSeason = 1;

        // update milestone stem and season.
        s.ss[token].milestoneStem = LibTokenSilo.stemTipForToken(token);
        s.ss[token].milestoneSeason = s.season.current;

        // stalkEarnedPerSeason is set to int32 before casting down.
        s.ss[token].deltaStalkEarnedPerSeason = int24(
            int32(stalkEarnedPerSeason) - int32(s.ss[token].stalkEarnedPerSeason)
        ); // calculate delta
        s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason;

        // stalkEarnedPerSeason is set to int32 before casting down.
        s.ss[token].deltaStalkEarnedPerSeason = (int32(stalkEarnedPerSeason) -
            int32(s.ss[token].stalkEarnedPerSeason)).toInt24();

        s.ss[token].stalkEarnedPerSeason = stalkEarnedPerSeason;
        emit UpdatedStalkPerBdvPerSeason(token, stalkEarnedPerSeason, s.season.current);
    }

    /**
     * @notice updates the oracle implementation for a token.
     */
    function updateOracleImplementationForToken(
        address token,
        Storage.Implementation memory oracleImplementation
    ) internal {
        Storage.SiloSettings storage ss = LibAppStorage.diamondStorage().ss[token];
        require(ss.selector != 0, "Whitelist: Token not whitelisted in Silo");

        // check that new implementation is valid.
        verifyOracleImplementation(
            oracleImplementation.target,
            oracleImplementation.selector,
            oracleImplementation.encodeType
        );

        AppStorage storage s = LibAppStorage.diamondStorage();
        s.oracleImplementation[token] = oracleImplementation;

        emit UpdatedOracleImplementationForToken(token, oracleImplementation);
    }

    /**
     * @notice updates the gauge point implementation for a token.
     */
    function updateGaugePointImplementationForToken(
        address token,
        Storage.Implementation memory gpImplementation
    ) internal {
        Storage.SiloSettings storage ss = LibAppStorage.diamondStorage().ss[token];
        require(ss.selector != 0, "Whitelist: Token not whitelisted in Silo");

        // check that new implementation is valid.
        verifyGaugePointImplementation(gpImplementation.target, gpImplementation.selector);

        ss.gaugePointImplementation = gpImplementation;

        emit UpdatedGaugePointImplementationForToken(token, gpImplementation);
    }

    /**
     * @notice updates the gauge point implementation for a token.
     */
    function updateLiqudityWeightImplementationForToken(
        address token,
        Storage.Implementation memory lwImplementation
    ) internal {
        Storage.SiloSettings storage ss = LibAppStorage.diamondStorage().ss[token];
        require(ss.selector != 0, "Whitelist: Token not whitelisted in Silo");

        // check that new implementation is valid.
        verifyLiquidityWeightImplementation(lwImplementation.target, lwImplementation.selector);

        ss.liquidityWeightImplementation = lwImplementation;

        emit UpdatedLiqudityWeightImplementationForToken(token, lwImplementation);
    }

    /**
     * @notice Removes an ERC-20 token from the Silo Whitelist.
     *
     */
    function dewhitelistToken(address token) internal {
        AppStorage storage s = LibAppStorage.diamondStorage();

        // before dewhitelisting, verify that `libWhitelistedTokens` are updated.
        LibWhitelistedTokens.updateWhitelistStatus(token, false, false, false);

        // set the stalkEarnedPerSeason to 1 and update milestone stem.
        // stalkEarnedPerSeason requires a min value of 1.
        updateStalkPerBdvPerSeasonForToken(token, 1);

        // delete the selector and encodeType.
        delete s.ss[token].selector;
        delete s.ss[token].encodeType;

        // delete gaugePoints, gaugePointSelector, liquidityWeightSelector, and optimalPercentDepositedBdv.
        delete s.ss[token].gaugePoints;
        delete s.ss[token].gpSelector;
        delete s.ss[token].lwSelector;
        delete s.ss[token].optimalPercentDepositedBdv;

        // delete implementations:
        delete s.oracleImplementation[token];
        delete s.ss[token].gaugePointImplementation;
        delete s.ss[token].liquidityWeightImplementation;

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
     * @notice Verifies whether a gaugePointSelector at an external contract
     * is valid for the gauge system.
     */
    function verifyOracleImplementation(
        address oracleImplementation,
        bytes4 selector,
        bytes1 encodeType
    ) internal view {
        bool success;
        // if the encode type is 0x01, verify using the chainlink implementation.
        if (encodeType == bytes1(0x01)) {
            (success, ) = oracleImplementation.staticcall(
                abi.encodeWithSelector(IChainlinkAggregator.decimals.selector)
            );
        } else if (encodeType == bytes1(0x02)) {
            // 0x02 is LibUniswapOracle
            console.log("verifyOracleImplementation verify uniswap oracle");
        } else {
            // verify you passed in a callable oracle selector
            (success, ) = oracleImplementation.staticcall(abi.encodeWithSelector(selector, 0));
        }

        require(success, "Whitelist: Invalid Oracle Implementation");
    }

    /**
     * @notice Verifies whether the gaugePointSelector is valid for the gauge system.
     */
    function verifyGaugePointSelector(bytes4 selector) internal view {
        verifyGaugePointImplementation(address(this), selector);
    }

    /**
     * @notice Verifies whether a gaugePointSelector at an external contract
     * is valid for the gauge system.
     */
    function verifyGaugePointImplementation(
        address gpImplementation,
        bytes4 selector
    ) internal view {
        // verify you passed in a callable gaugePoint selector
        (bool success, ) = gpImplementation.staticcall(abi.encodeWithSelector(selector, 0, 0, 0));
        require(success, "Whitelist: Invalid GaugePoint selector");
    }

    /**
     * @notice Verifies whether the selector is valid for the gauge system.
     */
    function verifyLiquidityWeightSelector(bytes4 selector) internal view {
        // verify you passed in a callable liquidityWeight selector
        verifyLiquidityWeightImplementation(address(this), selector);
    }

    /**
     * @notice Verifies whether liquidityWeight selector at an external contract
     * is valid for the gauge system.
     */
    function verifyLiquidityWeightImplementation(
        address lwImplementation,
        bytes4 selector
    ) internal view {
        // verify you passed in a callable liquidityWeight selector
        (bool success, ) = lwImplementation.staticcall(abi.encodeWithSelector(selector));
        require(success, "Whitelist: Invalid LiquidityWeight selector");
    }
}
