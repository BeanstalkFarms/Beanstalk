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
import '../libraries/LibUniswap.sol';
import '../mocks/MockUniswapV2Factory.sol';

/**
 * @author Publius
 * @title Mock Init Diamond
**/
contract MockInitDiamond {

    event Incentivization(address indexed account, uint256 beans);

    address private constant WETH = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    address private constant BEAN = address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db);
    address private constant BEANLUSD = address(0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D);
    address private constant LUSD = address(0x5f98805A4E8be255a32880FDeC7F6728C6568bA0);
    address private constant THREE_CURVE = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
    address private constant BEAN_3CRV = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);
 
    AppStorage internal s;

    function init(address mockRouter) external {
        s.c.bean = BEAN;
        s.c.weth = WETH;
        s.c.pair = address(new MockUniswapV2Pair(s.c.weth, s.c.bean));
        s.c.pegPair = address(new MockUniswapV2Pair(s.c.bean, s.c.weth));
        MockUniswapV2Router(mockRouter).setPair(s.c.pair, s.c.weth, s.c.bean);

        IBean(s.c.bean).approve(mockRouter, uint256(-1));
        IUniswapV2Pair(s.c.pair).approve(mockRouter, uint256(-1));
        IWETH(s.c.weth).approve(mockRouter, uint256(-1));
	      IBean(s.c.bean).approve(BEANLUSD, uint256(-1));
	      IERC20(LUSD).approve(BEANLUSD, uint256(-1));
        IERC20(THREE_CURVE).approve(BEAN_3CRV, uint256(-1));
        IBean(s.c.bean).approve(BEAN_3CRV, uint256(-1));

        s.cases = [int8(3),1,0,0,-1,-3,-3,0,3,1,0,0,-1,-3,-3,0,3,3,1,0,0,0,-1,0,3,3,1,0,1,0,-1,0];
        s.w.yield = 1;

        s.season.current = 1;
        s.season.withdrawSeasons = 25;
        s.season.start = block.timestamp;
        s.season.timestamp = block.timestamp;

        s.index = (IUniswapV2Pair(s.c.pair).token0() == s.c.bean) ? 0 : 1;
        LibUniswap.initMarket(s.c.bean, s.c.weth, mockRouter);
        s.remainingEth = 1;
    }

}
