/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {AppStorage} from "../storage/AppStorage.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC1155} from "@openzeppelin/contracts/token/ERC1155/IERC1155.sol";
import {IDiamondCut} from "../../interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "../../interfaces/IDiamondLoupe.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibIncentive} from "../../libraries/LibIncentive.sol";
import {LibCases} from "../../libraries/LibCases.sol";
import {LibGauge} from "contracts/libraries/LibGauge.sol";
import {C} from "../../C.sol";
import {IBean} from "../../interfaces/IBean.sol";
import {IWETH} from "../../interfaces/IWETH.sol";
import {MockToken} from "../../mocks/MockToken.sol";
import {Weather} from "contracts/beanstalk/sun/SeasonFacet/Weather.sol";
import {LibIncentive} from "contracts/libraries/LibIncentive.sol";

/**
 * @author Publius
 * @title InitDiamond
 * @notice InitDiamond initializes the Beanstalk Diamond.
 **/
contract InitDiamond is Weather {
    address private constant PEG_PAIR = address(0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc);

    function init() external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[0xd9b67a26] = true; // ERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // ERC1155Metadata

        LibCases.setCasesV2();
        s.sys.weather.temp = 1;

        s.sys.season.current = 1;
        s.sys.season.withdrawSeasons = 25;
        s.sys.season.period = C.getSeasonPeriod();
        s.sys.season.timestamp = block.timestamp;
        s.sys.season.start = s.sys.season.period > 0
            ? (block.timestamp / s.sys.season.period) * s.sys.season.period
            : block.timestamp;

        s.sys.weather.thisSowTime = type(uint32).max;
        s.sys.weather.lastSowTime = type(uint32).max;
        s.sys.isFarm = 1;

        s.sys.usdTokenPrice[C.BEAN_ETH_WELL] = 1;
        s.sys.twaReserves[C.BEAN_ETH_WELL].reserve0 = 1;
        s.sys.twaReserves[C.BEAN_ETH_WELL].reserve1 = 1;

        s.sys.seedGauge.beanToMaxLpGpPerBdvRatio = 50e18; // 50%
        s.sys.seedGauge.averageGrownStalkPerBdvPerSeason = 3e6;

        emit BeanToMaxLpGpPerBdvRatioChange(
            s.sys.season.current,
            type(uint256).max,
            int80(int128(s.sys.seedGauge.beanToMaxLpGpPerBdvRatio))
        );
        emit LibGauge.UpdateAverageStalkPerBdvPerSeason(
            s.sys.seedGauge.averageGrownStalkPerBdvPerSeason
        );
    }
}
