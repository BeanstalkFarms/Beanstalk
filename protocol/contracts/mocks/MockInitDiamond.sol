/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol";
import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import "../interfaces/IBean.sol";
import "../interfaces/IWETH.sol";
import "../mocks/MockToken.sol";
import "../mocks/MockUniswapV2Pair.sol";
import "../mocks/MockUniswapV2Router.sol";
import {AppStorage} from "../farm/AppStorage.sol";
import {LibMarket} from "../libraries/LibMarket.sol";

/**
 * @author Publius
 * @title Mock Init Diamond
**/
contract MockInitDiamond {

    event Incentivization(address indexed account, uint256 beans);

    AppStorage internal s;

    function init(address mockRouter) external {
        s.c.bean = address(new MockToken("BEAN", "Beanstalk"));
        s.c.pair = address(new MockUniswapV2Pair(s.c.bean));
        s.c.pegPair = address(new MockUniswapV2Pair(s.c.weth));
        MockUniswapV2Router(mockRouter).setPair(s.c.pair);
        s.c.weth = IUniswapV2Router02(mockRouter).WETH();

        IBean(s.c.bean).approve(mockRouter, uint256(-1));
        IUniswapV2Pair(s.c.pair).approve(mockRouter, uint256(-1));
        IWETH(s.c.weth).approve(mockRouter, uint256(-1));

        s.cases = [int8(3),1,0,0,-1,-3,-3,0,3,1,0,0,-1,-3,-3,0,3,3,1,0,0,0,-1,0,3,3,1,0,1,0,-1,0];
        s.w.yield = 1;

        s.season.current = 1;
        s.season.withdrawSeasons = 25;
        s.season.start = block.timestamp;
        s.season.timestamp = block.timestamp;

        s.index = (IUniswapV2Pair(s.c.pair).token0() == s.c.bean) ? 0 : 1;
        LibMarket.initMarket(s.c.bean, s.c.weth, mockRouter);
    }

}
