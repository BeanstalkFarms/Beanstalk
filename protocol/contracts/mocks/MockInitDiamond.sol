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

import 'hardhat/console.sol';

/**
 * @author Publius
 * @title Mock Init Diamond
**/
contract MockInitDiamond {

    address private constant WETH = address(0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2);
    address private constant BEAN = address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db);
    address private constant MOCK_FACTORY = address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);
    address private constant MAINNET_PAIR = address(0x87898263B6C5BABe34b4ec53F22d98430b91e371);
    address private constant PEG_PAIR = address(0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc);

    event Incentivization(address indexed account, uint256 beans);

    AppStorage internal s;

    function init(address mockRouter) external {
	s.c.bean = BEAN;
	s.c.weth = WETH;
        s.c.pair = MAINNET_PAIR;
        s.c.pegPair = PEG_PAIR;
        MockUniswapV2Router(mockRouter).setPair(s.c.pair, WETH, BEAN);

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
        LibUniswap.initMarket(s.c.bean, s.c.weth, mockRouter);
    }

}
