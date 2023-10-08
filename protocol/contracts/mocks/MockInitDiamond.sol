/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IBean.sol";
import "../interfaces/IWETH.sol";
import "../mocks/MockToken.sol";
import {AppStorage} from "../beanstalk/AppStorage.sol";
import "../C.sol";
import "contracts/beanstalk/init/InitWhitelist.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {LibCases} from "../libraries/LibCases.sol";

/**
 * @author Publius
 * @title Mock Init Diamond
**/
contract MockInitDiamond is InitWhitelist {

    event Incentivization(address indexed account, uint256 beans);

    AppStorage internal s;

    function init() external {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();

        C.bean().approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);
        C.bean().approve(C.curveZapAddress(), type(uint256).max);
        C.usdc().approve(C.curveZapAddress(), type(uint256).max);
        ds.supportedInterfaces[0xd9b67a26] = true; // ERC1155
        ds.supportedInterfaces[0x0e89341c] = true; // ERC1155Metadata

        LibCases.setCasesV2();
        s.w.t = 1;

        s.w.thisSowTime = type(uint32).max;
        s.w.lastSowTime = type(uint32).max;

        s.season.current = 1;
        s.season.withdrawSeasons = 25;
        s.season.period = C.getSeasonPeriod();
        s.season.timestamp = block.timestamp;
        s.season.start = s.season.period > 0 ?
            (block.timestamp / s.season.period) * s.season.period :
            block.timestamp;
        s.isFarm = 1;
        s.usdTokenPrice[C.BEAN_ETH_WELL] = 1;
        s.twaReserves[C.BEAN_ETH_WELL] = Storage.TwaReserves(1, 1);
        s.season.stemStartSeason = uint16(s.season.current);
        s.seedGauge.beanToMaxLpGpPerBDVRatio = 50e18; // 50%
        // 4 + 4 + 2
        s.seedGauge.averageGrownStalkPerBdvPerSeason = 3e6;
        whitelistPools();
    }

}