/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IBean.sol";
import "../interfaces/IWETH.sol";
import "../mocks/MockToken.sol";
import {AppStorage} from "../farm/AppStorage.sol";
import "../C.sol";
import "../libraries/LibWhitelist.sol";

/**
 * @author Publius
 * @title Mock Init Diamond
**/
contract MockInitDiamond {

    event Incentivization(address indexed account, uint256 beans);

    AppStorage internal s;

    function init(address bean) external {
        s.c.bean = bean;

        IBean(bean).approve(C.curveMetapoolAddress(), type(uint256).max);
        IBean(bean).approve(C.curveBeanLUSDAddress(), type(uint256).max);

        s.cases = s.cases = [
        // Dsc, Sdy, Inc, nul
       int8(3),   1,   0,   0,  // Exs Low: P < 1
            -1,  -3,  -3,   0,  //          P > 1
             3,   1,   0,   0,  // Rea Low: P < 1
            -1,  -3,  -3,   0,  //          P > 1
             3,   3,   1,   0,  // Rea Hgh: P < 1
             0,  -1,  -3,   0,  //          P > 1
             3,   3,   1,   0,  // Exs Hgh: P < 1
             0,  -1,  -3,   0   //          P > 1
        ];
        s.w.yield = 1;

        s.w.nextSowTime = type(uint32).max;
        s.w.lastSowTime = type(uint32).max;
    
        s.refundStatus = 1;
        s.beanRefundAmount = 1;
        s.ethRefundAmount = 1;

        s.season.current = 1;
        s.season.withdrawSeasons = 25;
        s.season.start = block.timestamp;
        s.season.timestamp = block.timestamp;

        LibWhitelist.whitelistPools();
    }

}