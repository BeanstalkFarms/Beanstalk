/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import './UniswapRouter.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';

/**
 * @author Beasley
 * @title Users call generalized uniswap functions (mainly for farm facets)
**/

contract UniswapFacet is UniswapRouter {

	using SafeMath for uint256;
	
	function sellBeansOnUniswap(uint256 amountIn, uint256 amountOutMin) public {
		address[] memory path = new address[](2);
		path[1] = s.c.bean;
		path[2] = s.c.weth;
		Storage.Settings memory set;
		set.toInternalBalance = false;
		set.fromInternalBalance = false;
		set.lightUpdateSilo = false;
		swapExactTokensForTokens(amountIn, amountOutMin, path, msg.sender, block.timestamp.add(1), set, false);
	}

	function buyBeansOnUniswap(uint256 amountOutMin, bool internalTransfer) public payable {
		address[] memory path = new address[](2);
		path[0] = s.c.weth;
		path[1] = s.c.bean;
		Storage.Settings memory set;
		set.toInternalBalance = false;
		set.fromInternalBalance = false;
		set.lightUpdateSilo = false;
		swapExactETHForTokens(amountOutMin, path, msg.sender, block.timestamp.add(1), set);
	}

	function addLiquidityOnUniswap(uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin) public {
		addLiquidity(s.c.bean, s.c.weth, amountADesired, amountBDesired, amountAMin, amountBMin, msg.sender, block.timestamp.add(1), false);
	}
	
	function addLiquidityETHOnUniswap(uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin) public payable {
		addLiquidityETH(s.c.bean, amountTokenDesired, amountTokenMin, amountETHMin, msg.sender, block.timestamp.add(1));
	}

	function removeLiquidityOnUniswap(uint256 liquidity, uint256 amountAMin, uint256 amountBMin) public {
		removeLiquidity(s.c.bean, s.c.weth, liquidity, amountAMin, amountBMin, msg.sender, block.timestamp.add(1), false);
	}
	
	function removeLiquidityETHOnUniswap(uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin) public {
		removeLiquidityETH(s.c.bean, liquidity, amountTokenMin, amountETHMin, msg.sender, block.timestamp.add(1));
	}
}
