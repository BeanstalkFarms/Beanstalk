/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {ILiquidityWeightFacet} from "contracts/beanstalk/sun/LiquidityWeightFacet.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {AssetSettings, Implementation} from "contracts/beanstalk/storage/System.sol";
import {IGaugePointFacet} from "contracts/beanstalk/sun/GaugePointFacet.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibCases} from "contracts/libraries/LibCases.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {BDVFacet} from "contracts/beanstalk/silo/BDVFacet.sol";
import {LibUnripe} from "contracts/libraries/LibUnripe.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {C} from "contracts/C.sol";

/**
 * @author Publius, Brean
 * @title InitalizeDiamond
 * @notice InitalizeDiamond provides helper functions to initalize beanstalk.
 **/

contract InitalizeDiamond {
    AppStorage internal s;

    // INITIAL CONSTANTS //
    uint128 constant INIT_BEAN_TO_MAX_LP_GP_RATIO = 33_333_333_333_333_333_333; // 33%
    uint128 constant INIT_AVG_GSPBDV = 3e6;
    uint32 constant INIT_BEAN_STALK_EARNED_PER_SEASON = 2e6;
    uint32 constant INIT_BEAN_TOKEN_WELL_STALK_EARNED_PER_SEASON = 4e6;
    uint32 constant INIT_STALK_ISSUED_PER_BDV = 1e4;
    uint128 constant INIT_TOKEN_G_POINTS = 100e18;
    uint32 constant INIT_BEAN_TOKEN_WELL_PERCENT_TARGET = 100e6;

    // Pod rate bounds
    uint256 internal constant POD_RATE_LOWER_BOUND = 0.05e18; // 5%
    uint256 internal constant POD_RATE_OPTIMAL = 0.15e18; // 15%
    uint256 internal constant POD_RATE_UPPER_BOUND = 0.25e18; // 25%

    // Change in Soil demand bounds
    uint256 internal constant DELTA_POD_DEMAND_LOWER_BOUND = 0.95e18; // 95%
    uint256 internal constant DELTA_POD_DEMAND_UPPER_BOUND = 1.05e18; // 105%

    // Liquidity to supply ratio bounds
    uint256 internal constant LP_TO_SUPPLY_RATIO_UPPER_BOUND = 0.8e18; // 80%
    uint256 internal constant LP_TO_SUPPLY_RATIO_OPTIMAL = 0.4e18; // 40%
    uint256 internal constant LP_TO_SUPPLY_RATIO_LOWER_BOUND = 0.12e18; // 12%

    // Excessive price threshold constant
    uint256 internal constant EXCESSIVE_PRICE_THRESHOLD = 1.05e6;

    // Gauge
    uint256 internal constant TARGET_SEASONS_TO_CATCHUP = 4320;
    uint256 internal constant MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO = 100e18;
    uint256 internal constant MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO = 50e18;

    // EVENTS:
    event BeanToMaxLpGpPerBdvRatioChange(uint256 indexed season, uint256 caseId, int80 absChange);

    /**
     * @notice Initalizes the diamond with base conditions.
     * @dev the base initalization initalizes various parameters,
     * as well as whitelists the bean and bean:TKN pools.
     */
    function initalizeDiamond(address bean, address beanTokenWell) internal {
        addInterfaces();
        initalizeSeason();
        initalizeField();
        initalizeFarmAndTractor();
        initalizeSilo(uint16(s.sys.season.current));
        initalizeSeedGauge(INIT_BEAN_TO_MAX_LP_GP_RATIO, INIT_AVG_GSPBDV);

        address[] memory tokens = new address[](2);
        tokens[0] = bean;
        tokens[1] = beanTokenWell;

        // note: bean and assets that are not in the gauge system
        // do not need to initalize the gauge system.
        Implementation memory impl = Implementation(address(0), bytes4(0), bytes1(0));
        Implementation memory liquidityWeightImpl = Implementation(
            address(0),
            ILiquidityWeightFacet.maxWeight.selector,
            bytes1(0)
        );
        Implementation memory gaugePointImpl = Implementation(
            address(0),
            IGaugePointFacet.defaultGaugePointFunction.selector,
            bytes1(0)
        );
        Implementation memory oracleImpl = Implementation(address(0), bytes4(0), bytes1(0));

        AssetSettings[] memory assetSettings = new AssetSettings[](2);
        assetSettings[0] = AssetSettings({
            selector: BDVFacet.beanToBDV.selector,
            stalkEarnedPerSeason: INIT_BEAN_STALK_EARNED_PER_SEASON,
            stalkIssuedPerBdv: INIT_STALK_ISSUED_PER_BDV,
            milestoneSeason: s.sys.season.current,
            milestoneStem: 0,
            encodeType: 0x00,
            deltaStalkEarnedPerSeason: 0,
            gaugePoints: 0,
            optimalPercentDepositedBdv: 0,
            gaugePointImplementation: impl,
            liquidityWeightImplementation: impl,
            oracleImplementation: oracleImpl
        });

        assetSettings[1] = AssetSettings({
            selector: BDVFacet.wellBdv.selector,
            stalkEarnedPerSeason: INIT_BEAN_TOKEN_WELL_STALK_EARNED_PER_SEASON,
            stalkIssuedPerBdv: INIT_STALK_ISSUED_PER_BDV,
            milestoneSeason: s.sys.season.current,
            milestoneStem: 0,
            encodeType: 0x01,
            deltaStalkEarnedPerSeason: 0,
            gaugePoints: INIT_TOKEN_G_POINTS,
            optimalPercentDepositedBdv: INIT_BEAN_TOKEN_WELL_PERCENT_TARGET,
            gaugePointImplementation: gaugePointImpl,
            liquidityWeightImplementation: liquidityWeightImpl,
            oracleImplementation: oracleImpl
        });

        whitelistPools(tokens, assetSettings);

        // init usdTokenPrice. C.Bean_eth_well should be
        // a bean well w/ the native token of the network.
        s.sys.usdTokenPrice[C.BEAN_ETH_WELL] = 1;
        s.sys.twaReserves[beanTokenWell].reserve0 = 1;
        s.sys.twaReserves[beanTokenWell].reserve1 = 1;

        // init tractor.
        LibTractor._tractorStorage().activePublisher = payable(address(1));
    }

    /**
     * @notice Adds ERC1155 and ERC1155Metadata interfaces to the diamond.
     */
    function addInterfaces() internal {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        ds.supportedInterfaces[0xd9b67a26] = true; // ERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // ERC1155Metadata
    }

    /**
     * @notice Initalizes field parameters.
     */
    function initalizeField() internal {
        s.sys.weather.temp = 1;
        s.sys.weather.thisSowTime = type(uint32).max;
        s.sys.weather.lastSowTime = type(uint32).max;
    }

    /**
     * @notice Initalizes season parameters.
     */
    function initalizeSeason() internal {
        // set current season to 1.
        s.sys.season.current = 1;

        // set withdraw seasons to 0. Kept here for verbosity.
        s.sys.season.withdrawSeasons = 0;

        // initalize the duration of 1 season in seconds.
        s.sys.season.period = C.getSeasonPeriod();

        // initalize current timestamp.
        s.sys.season.timestamp = block.timestamp;

        // initalize the start timestamp.
        // Rounds down to the nearest hour
        // if needed.
        s.sys.season.start = s.sys.season.period > 0
            ? (block.timestamp / s.sys.season.period) * s.sys.season.period
            : block.timestamp;

        // initalizes the cases that beanstalk uses
        // to change certain parameters of itself.
        setCases();

        initializeSeedGaugeSettings();
    }

    /**
     * @notice Initalize the cases for the diamond.
     */
    function setCases() internal {
        LibCases.setCasesV2();
    }

    /**
     * Initalizes silo parameters.
     */
    function initalizeSilo(uint16 season) internal {
        // initalize when the silo started silo V3.
        s.sys.season.stemStartSeason = season;
        s.sys.season.stemScaleSeason = season;
    }

    function initalizeSeedGauge(
        uint128 beanToMaxLpGpRatio,
        uint128 averageGrownStalkPerBdvPerSeason
    ) internal {
        // initalize the ratio of bean to max lp gp per bdv.
        s.sys.seedGauge.beanToMaxLpGpPerBdvRatio = beanToMaxLpGpRatio;

        // initalize the average grown stalk per bdv per season.
        s.sys.seedGauge.averageGrownStalkPerBdvPerSeason = averageGrownStalkPerBdvPerSeason;

        // emit events.
        emit BeanToMaxLpGpPerBdvRatioChange(
            s.sys.season.current,
            type(uint256).max,
            int80(int128(s.sys.seedGauge.beanToMaxLpGpPerBdvRatio))
        );
        emit LibGauge.UpdateAverageStalkPerBdvPerSeason(
            s.sys.seedGauge.averageGrownStalkPerBdvPerSeason
        );
    }

    /**
     * Whitelists the pools.
     * @param assetSettings The pools to whitelist.
     */
    function whitelistPools(
        address[] memory tokens,
        AssetSettings[] memory assetSettings
    ) internal {
        for (uint256 i = 0; i < tokens.length; i++) {
            // note: no error checking.
            s.sys.silo.assetSettings[tokens[i]] = assetSettings[i];

            bool isLPandWell = true;
            if (tokens[i] == C.BEAN) {
                isLPandWell = false;
            }
            bool isUnripe = LibUnripe.isUnripe(tokens[i]);

            // All tokens (excluding bean) are assumed to be
            // - whitelisted,
            // - an LP and well.
            LibWhitelistedTokens.addWhitelistStatus(
                tokens[i],
                true, // is whitelisted,
                isLPandWell,
                isLPandWell,
                !isUnripe && isLPandWell // assumes any non-unripe LP is soppable, may not be true in the future
            );
        }
    }

    function initializeSeedGaugeSettings() internal {
        s.sys.seedGaugeSettings.maxBeanMaxLpGpPerBdvRatio = MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO;
        s.sys.seedGaugeSettings.minBeanMaxLpGpPerBdvRatio = MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO;
        s.sys.seedGaugeSettings.targetSeasonsToCatchUp = TARGET_SEASONS_TO_CATCHUP;
        s.sys.seedGaugeSettings.podRateLowerBound = POD_RATE_LOWER_BOUND;
        s.sys.seedGaugeSettings.podRateOptimal = POD_RATE_OPTIMAL;
        s.sys.seedGaugeSettings.podRateUpperBound = POD_RATE_UPPER_BOUND;
        s.sys.seedGaugeSettings.deltaPodDemandLowerBound = DELTA_POD_DEMAND_LOWER_BOUND;
        s.sys.seedGaugeSettings.deltaPodDemandUpperBound = DELTA_POD_DEMAND_UPPER_BOUND;
        s.sys.seedGaugeSettings.lpToSupplyRatioUpperBound = LP_TO_SUPPLY_RATIO_UPPER_BOUND;
        s.sys.seedGaugeSettings.lpToSupplyRatioOptimal = LP_TO_SUPPLY_RATIO_OPTIMAL;
        s.sys.seedGaugeSettings.lpToSupplyRatioLowerBound = LP_TO_SUPPLY_RATIO_LOWER_BOUND;
        s.sys.seedGaugeSettings.excessivePriceThreshold = EXCESSIVE_PRICE_THRESHOLD;
    }

    function initalizeFarmAndTractor() public {
        s.sys.isFarm = 1;
        LibTractor._resetPublisher();
    }
}
