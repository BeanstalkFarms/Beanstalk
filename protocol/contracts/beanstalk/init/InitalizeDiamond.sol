/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {ILiquidityWeightFacet} from "contracts/beanstalk/sun/LiquidityWeightFacet.sol";
import {LibWhitelistedTokens} from "contracts/libraries/Silo/LibWhitelistedTokens.sol";
import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {AssetSettings} from "contracts/beanstalk/storage/System.sol";
import {IGaugePointFacet} from "contracts/beanstalk/sun/GaugePointFacet.sol";
import {LibDiamond} from "contracts/libraries/LibDiamond.sol";
import {LibCases} from "contracts/libraries/LibCases.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {BDVFacet} from "contracts/beanstalk/silo/BDVFacet.sol";
import {C} from "contracts/C.sol";

import "hardhat/console.sol";

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
        initalizeSilo(uint16(s.system.season.current));
        initalizeSeedGauge(INIT_BEAN_TO_MAX_LP_GP_RATIO, INIT_AVG_GSPBDV);

        address[] memory tokens = new address[](2);
        tokens[0] = bean;
        tokens[1] = beanTokenWell;

        // note: bean and assets that are not in the gauge system
        // do not need to initalize the gauge system.
        AssetSettings[] memory assetSettings = new AssetSettings[](2);
        assetSettings[0] = AssetSettings({
            selector: BDVFacet.beanToBDV.selector,
            stalkEarnedPerSeason: INIT_BEAN_STALK_EARNED_PER_SEASON,
            stalkIssuedPerBdv: INIT_STALK_ISSUED_PER_BDV,
            milestoneSeason: s.system.season.current,
            milestoneStem: 0,
            encodeType: 0x00,
            deltaStalkEarnedPerSeason: 0,
            gpSelector: bytes4(0),
            lwSelector: bytes4(0),
            gaugePoints: 0,
            optimalPercentDepositedBdv: 0
        });

        assetSettings[1] = AssetSettings({
            selector: BDVFacet.wellBdv.selector,
            stalkEarnedPerSeason: INIT_BEAN_TOKEN_WELL_STALK_EARNED_PER_SEASON,
            stalkIssuedPerBdv: INIT_STALK_ISSUED_PER_BDV,
            milestoneSeason: s.system.season.current,
            milestoneStem: 0,
            encodeType: 0x01,
            deltaStalkEarnedPerSeason: 0,
            gpSelector: IGaugePointFacet.defaultGaugePointFunction.selector,
            lwSelector: ILiquidityWeightFacet.maxWeight.selector,
            gaugePoints: INIT_TOKEN_G_POINTS,
            optimalPercentDepositedBdv: INIT_BEAN_TOKEN_WELL_PERCENT_TARGET
        });

        whitelistPools(tokens, assetSettings);

        // init usdTokenPrice. C.Bean_eth_well should be
        // a bean well w/ the native token of the network.
        s.system.usdTokenPrice[C.BEAN_ETH_WELL] = 1;
        s.system.twaReserves[beanTokenWell].reserve0 = 1;
        s.system.twaReserves[beanTokenWell].reserve1 = 1;
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
        s.system.weather.t = 1;
        s.system.weather.thisSowTime = type(uint32).max;
        s.system.weather.lastSowTime = type(uint32).max;
        s.system.isFarm = 1;
    }

    /**
     * @notice Initalizes season parameters.
     */
    function initalizeSeason() internal {
        // set current season to 1.
        s.system.season.current = 1;

        // set withdraw seasons to 0. Kept here for verbosity.
        s.system.season.withdrawSeasons = 0;

        // initalize the duration of 1 season in seconds.
        s.system.season.period = C.getSeasonPeriod();

        // initalize current timestamp.
        s.system.season.timestamp = block.timestamp;

        // initalize the start timestamp.
        // Rounds down to the nearest hour
        // if needed.
        s.system.season.start = s.system.season.period > 0
            ? (block.timestamp / s.system.season.period) * s.system.season.period
            : block.timestamp;

        // initalizes the cases that beanstalk uses
        // to change certain parameters of itself.
        setCases();
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
        s.system.season.stemStartSeason = season;
        s.system.season.stemScaleSeason = season;
    }

    function initalizeSeedGauge(
        uint128 beanToMaxLpGpRatio,
        uint128 averageGrownStalkPerBdvPerSeason
    ) internal {
        // initalize the ratio of bean to max lp gp per bdv.
        s.system.seedGauge.beanToMaxLpGpPerBdvRatio = beanToMaxLpGpRatio;

        // initalize the average grown stalk per bdv per season.
        s.system.seedGauge.averageGrownStalkPerBdvPerSeason = averageGrownStalkPerBdvPerSeason;

        // emit events.
        emit BeanToMaxLpGpPerBdvRatioChange(
            s.system.season.current,
            type(uint256).max,
            int80(int128(s.system.seedGauge.beanToMaxLpGpPerBdvRatio))
        );
        emit LibGauge.UpdateAverageStalkPerBdvPerSeason(
            s.system.seedGauge.averageGrownStalkPerBdvPerSeason
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
            s.system.silo.assetSettings[tokens[i]] = assetSettings[i];

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
}
