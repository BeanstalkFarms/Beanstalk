/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {IBean} from "../interfaces/IBean.sol";
import {IWETH} from "../interfaces/IWETH.sol";
import {MockToken} from "../mocks/MockToken.sol";
import {AppStorage} from "../beanstalk/storage/AppStorage.sol";
import {C} from "../C.sol";
import {InitWhitelist} from "contracts/beanstalk/init/InitWhitelist.sol";
import {InitWhitelistStatuses} from "contracts/beanstalk/init/InitWhitelistStatuses.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibCases} from "../libraries/LibCases.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {Weather} from "contracts/beanstalk/sun/SeasonFacet/Weather.sol";

/**
 * @author Publius
 * @title Mock Init Diamond
 **/
contract MockInitDiamond is InitWhitelist, InitWhitelistStatuses, Weather {
    function init() external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        ds.supportedInterfaces[0xd9b67a26] = true; // ERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // ERC1155Metadata

        LibCases.setCasesV2();
        s.system.weather.t = 1;

        s.system.weather.thisSowTime = type(uint32).max;
        s.system.weather.lastSowTime = type(uint32).max;

        s.system.season.current = 1;
        s.system.season.withdrawSeasons = 25;
        s.system.season.period = C.getSeasonPeriod();
        s.system.season.timestamp = block.timestamp;
        s.system.season.start = s.system.season.period > 0
            ? (block.timestamp / s.system.season.period) * s.system.season.period
            : block.timestamp;
        s.system.isFarm = 1;
        s.system.usdTokenPrice[C.BEAN_ETH_WELL] = 1;
        s.system.twaReserves[C.BEAN_ETH_WELL].reserve0 = 1;
        s.system.twaReserves[C.BEAN_ETH_WELL].reserve1 = 1;

        s.system.season.stemStartSeason = uint16(s.system.season.current);
        s.system.season.stemScaleSeason = uint16(s.system.season.current);
        s.system.seedGauge.beanToMaxLpGpPerBdvRatio = 50e18; // 50%
        s.system.seedGauge.averageGrownStalkPerBdvPerSeason = 3e6;

        LibTractor._resetPublisher();

        s.system.silo.unripeSettings[C.UNRIPE_LP].underlyingToken = C.BEAN_WSTETH_WELL;

        emit BeanToMaxLpGpPerBdvRatioChange(
            s.system.season.current,
            type(uint256).max,
            int80(int128(s.system.seedGauge.beanToMaxLpGpPerBdvRatio))
        );
        emit LibGauge.UpdateAverageStalkPerBdvPerSeason(
            s.system.seedGauge.averageGrownStalkPerBdvPerSeason
        );

        whitelistPools();
        addWhitelistStatuses(false);
    }
}
