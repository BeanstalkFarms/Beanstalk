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
        s.sys.weather.temp = 1;

        s.sys.weather.thisSowTime = type(uint32).max;
        s.sys.weather.lastSowTime = type(uint32).max;

        s.sys.season.current = 1;
        s.sys.season.withdrawSeasons = 25;
        s.sys.season.period = C.getSeasonPeriod();
        s.sys.season.timestamp = block.timestamp;
        s.sys.season.start = s.sys.season.period > 0
            ? (block.timestamp / s.sys.season.period) * s.sys.season.period
            : block.timestamp;
        s.sys.isFarm = 1;
        s.sys.usdTokenPrice[C.BEAN_ETH_WELL] = 1;
        s.sys.twaReserves[C.BEAN_ETH_WELL].reserve0 = 1;
        s.sys.twaReserves[C.BEAN_ETH_WELL].reserve1 = 1;

        s.sys.season.stemStartSeason = uint16(s.sys.season.current);
        s.sys.season.stemScaleSeason = uint16(s.sys.season.current);
        s.sys.seedGauge.beanToMaxLpGpPerBdvRatio = 50e18; // 50%
        s.sys.seedGauge.averageGrownStalkPerBdvPerSeason = 3e6;

        LibTractor._resetPublisher();

        s.sys.silo.unripeSettings[C.UNRIPE_LP].underlyingToken = C.BEAN_WSTETH_WELL;

        emit BeanToMaxLpGpPerBdvRatioChange(
            s.sys.season.current,
            type(uint256).max,
            int80(int128(s.sys.seedGauge.beanToMaxLpGpPerBdvRatio))
        );
        emit LibGauge.UpdateAverageStalkPerBdvPerSeason(
            s.sys.seedGauge.averageGrownStalkPerBdvPerSeason
        );

        whitelistPools();
        addWhitelistStatuses(false);
    }
}
