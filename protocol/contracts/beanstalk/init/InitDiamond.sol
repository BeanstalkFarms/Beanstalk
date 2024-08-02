/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage, Storage} from "../AppStorage.sol";
import {IERC165} from "../../interfaces/IERC165.sol";
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
 * @title Init Diamond initializes the Beanstalk Diamond.
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

        C.bean().approve(C.CURVE_BEAN_METAPOOL, type(uint256).max);
        C.bean().approve(C.curveZapAddress(), type(uint256).max);
        C.usdc().approve(C.curveZapAddress(), type(uint256).max);

        LibCases.setCasesV2();
        s.w.t = 1;

        s.season.current = 1;
        s.season.withdrawSeasons = 25;
        s.season.period = C.getSeasonPeriod();
        s.season.timestamp = block.timestamp;
        s.season.start = s.season.period > 0 ?
            (block.timestamp / s.season.period) * s.season.period :
            block.timestamp;

        s.w.thisSowTime = type(uint32).max;
        s.w.lastSowTime = type(uint32).max;
        s.isFarm = 1;

        s.usdTokenPrice[C.BEAN_ETH_WELL] = 1;
        s.twaReserves[C.BEAN_ETH_WELL].reserve0 = 1;
        s.twaReserves[C.BEAN_ETH_WELL].reserve1 = 1;

        s.seedGauge.beanToMaxLpGpPerBdvRatio = 50e18; // 50%
        s.seedGauge.averageGrownStalkPerBdvPerSeason = 3e6;

        emit BeanToMaxLpGpPerBdvRatioChange(s.season.current, type(uint256).max, int80(s.seedGauge.beanToMaxLpGpPerBdvRatio));
        emit LibGauge.UpdateAverageStalkPerBdvPerSeason(s.seedGauge.averageGrownStalkPerBdvPerSeason);

        C.bean().mint(msg.sender, LibIncentive.MAX_REWARD);
        emit LibIncentive.Incentivization(msg.sender, LibIncentive.MAX_REWARD);
    }

}
