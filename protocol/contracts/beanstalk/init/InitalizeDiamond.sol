/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {ILiquidityWeightFacet} from "contracts/beanstalk/sun/LiquidityWeightFacet.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {AppStorage, Storage} from "contracts/beanstalk/AppStorage.sol";
import {IGaugePointFacet} from "contracts/beanstalk/sun/GaugePointFacet.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibCases} from "contracts/libraries/LibCases.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {BDVFacet} from "contracts/beanstalk/silo/BDVFacet.sol";
import {C} from "contracts/C.sol";

/**
 * @author Publius, Brean
 * @title InitalizeDiamond
 * @notice InitalizeDiamond provides helper functions to initalize beanstalk.
 **/

contract InitalizeDiamond {
    AppStorage internal s;

    // INITAL CONSTANTS //
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
        initalizeSilo(uint16(s.season.current));
        initalizeSeedGauge(INIT_BEAN_TO_MAX_LP_GP_RATIO, INIT_AVG_GSPBDV);

        address[] memory tokens = new address[](2);
        tokens[0] = bean;
        tokens[1] = beanTokenWell;

        // note: bean and assets that are not in the gauge system
        // do not need to initalize the gauge system.
        Storage.Implementation memory impl = Storage.Implementation(
            address(0),
            bytes4(0),
            bytes1(0)
        );
        Storage.Implementation memory liquidityWeightImpl = Storage.Implementation(
            address(0),
            ILiquidityWeightFacet.maxWeight.selector,
            bytes1(0)
        );
        Storage.Implementation memory gaugePointImpl = Storage.Implementation(
            address(0),
            IGaugePointFacet.defaultGaugePointFunction.selector,
            bytes1(0)
        );

        Storage.SiloSettings[] memory siloSettings = new Storage.SiloSettings[](2);
        siloSettings[0] = Storage.SiloSettings({
            selector: BDVFacet.beanToBDV.selector,
            stalkEarnedPerSeason: INIT_BEAN_STALK_EARNED_PER_SEASON,
            stalkIssuedPerBdv: INIT_STALK_ISSUED_PER_BDV,
            milestoneSeason: s.season.current,
            milestoneStem: 0,
            encodeType: 0x00,
            deltaStalkEarnedPerSeason: 0,
            gpSelector: bytes4(0),
            lwSelector: bytes4(0),
            gaugePoints: 0,
            optimalPercentDepositedBdv: 0,
            gaugePointImplementation: impl,
            liquidityWeightImplementation: impl
        });

        siloSettings[1] = Storage.SiloSettings({
            selector: BDVFacet.wellBdv.selector,
            stalkEarnedPerSeason: INIT_BEAN_TOKEN_WELL_STALK_EARNED_PER_SEASON,
            stalkIssuedPerBdv: INIT_STALK_ISSUED_PER_BDV,
            milestoneSeason: s.season.current,
            milestoneStem: 0,
            encodeType: 0x01,
            deltaStalkEarnedPerSeason: 0,
            gpSelector: IGaugePointFacet.defaultGaugePointFunction.selector,
            lwSelector: ILiquidityWeightFacet.maxWeight.selector,
            gaugePoints: INIT_TOKEN_G_POINTS,
            optimalPercentDepositedBdv: INIT_BEAN_TOKEN_WELL_PERCENT_TARGET,
            gaugePointImplementation: gaugePointImpl,
            liquidityWeightImplementation: liquidityWeightImpl
        });

        whitelistPools(tokens, siloSettings);

        // init usdTokenPrice. C.Bean_eth_well should be
        // a bean well w/ the native token of the network.
        s.usdTokenPrice[C.BEAN_ETH_WELL] = 1;
        s.twaReserves[beanTokenWell].reserve0 = 1;
        s.twaReserves[beanTokenWell].reserve1 = 1;
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
        s.w.t = 1;
        s.w.thisSowTime = type(uint32).max;
        s.w.lastSowTime = type(uint32).max;
        s.isFarm = 1;
    }

    /**
     * @notice Initalizes season parameters.
     */
    function initalizeSeason() internal {
        // set current season to 1.
        s.season.current = 1;

        // set withdraw seasons to 0. Kept here for verbosity.
        s.season.withdrawSeasons = 0;

        // initalize the duration of 1 season in seconds.
        s.season.period = C.getSeasonPeriod();

        // initalize current timestamp.
        s.season.timestamp = block.timestamp;

        // initalize the start timestamp.
        // Rounds down to the nearest hour
        // if needed.
        s.season.start = s.season.period > 0
            ? (block.timestamp / s.season.period) * s.season.period
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
        s.season.stemStartSeason = season;
        s.season.stemScaleSeason = season;
    }

    function initalizeSeedGauge(
        uint128 beanToMaxLpGpRatio,
        uint128 averageGrownStalkPerBdvPerSeason
    ) internal {
        // initalize the ratio of bean to max lp gp per bdv.
        s.seedGauge.beanToMaxLpGpPerBdvRatio = beanToMaxLpGpRatio;

        // initalize the average grown stalk per bdv per season.
        s.seedGauge.averageGrownStalkPerBdvPerSeason = averageGrownStalkPerBdvPerSeason;

        // emit events.
        emit BeanToMaxLpGpPerBdvRatioChange(
            s.season.current,
            type(uint256).max,
            int80(int128(s.seedGauge.beanToMaxLpGpPerBdvRatio))
        );
        emit LibGauge.UpdateAverageStalkPerBdvPerSeason(
            s.seedGauge.averageGrownStalkPerBdvPerSeason
        );
    }

    /**
     * Whitelists the pools.
     * @param siloSettings The pools to whitelist.
     */
    function whitelistPools(
        address[] memory tokens,
        Storage.SiloSettings[] memory siloSettings
    ) internal {
        for (uint256 i = 0; i < tokens.length; i++) {
            // note: no error checking.
            s.ss[tokens[i]] = siloSettings[i];

            bool isLPandWell = true;
            if (tokens[i] == C.BEAN) {
                isLPandWell = false;
            }

            // All tokens (excluding bean) are assumed to be
            // - whitelisted,
            // - an LP and well.
            LibWhitelistedTokens.addWhitelistStatus(
                tokens[i],
                true, // is whitelisted,
                isLPandWell,
                isLPandWell
            );
        }
    }

    function initializeSeedGaugeSettings() internal {
        s.seedGaugeSettings.maxBeanMaxLpGpPerBdvRatio = MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO;
        s.seedGaugeSettings.minBeanMaxLpGpPerBdvRatio = MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO;
        s.seedGaugeSettings.targetSeasonsToCatchUp = TARGET_SEASONS_TO_CATCHUP;
        s.seedGaugeSettings.podRateLowerBound = POD_RATE_LOWER_BOUND;
        s.seedGaugeSettings.podRateOptimal = POD_RATE_OPTIMAL;
        s.seedGaugeSettings.podRateUpperBound = POD_RATE_UPPER_BOUND;
        s.seedGaugeSettings.deltaPodDemandLowerBound = DELTA_POD_DEMAND_LOWER_BOUND;
        s.seedGaugeSettings.deltaPodDemandUpperBound = DELTA_POD_DEMAND_UPPER_BOUND;
        s.seedGaugeSettings.lpToSupplyRatioUpperBound = LP_TO_SUPPLY_RATIO_UPPER_BOUND;
        s.seedGaugeSettings.lpToSupplyRatioOptimal = LP_TO_SUPPLY_RATIO_OPTIMAL;
        s.seedGaugeSettings.lpToSupplyRatioLowerBound = LP_TO_SUPPLY_RATIO_LOWER_BOUND;
        s.seedGaugeSettings.excessivePriceThreshold = EXCESSIVE_PRICE_THRESHOLD;
    }
}
