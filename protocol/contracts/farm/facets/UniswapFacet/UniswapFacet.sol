/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../../../libraries/LibUniswap.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '../../AppStorage.sol';

/**
 * @author Beasley
 * @title Users call generalized uniswap functions from LibUniswap (for farm facet)
**/

contract UniswapFacet {

	using SafeMath for uint256;

	AppStorage internal s;
	
	function sellBeansOnUniswap(uint256 amountIn, uint256 amountOutMin) public {
		address[] memory path = new address[](2);
		path[0] = s.c.bean;
		path[1] = s.c.weth;
		Storage.Settings memory set;
		set.toInternalBalance = true;
		set.fromInternalBalance = true;
		set.lightUpdateSilo = false;
		LibUniswap.swapExactTokensForTokens(amountIn, amountOutMin, path, msg.sender, block.timestamp.add(1), set, false);
	}

	function buyBeansOnUniswap(uint256 amountOutMin) public payable {
		address[] memory path = new address[](2);
		path[0] = s.c.weth;
		path[1] = s.c.bean;
		Storage.Settings memory set;
		set.toInternalBalance = true;
 		set.fromInternalBalance = true;
		set.lightUpdateSilo = false;
		LibUniswap.swapExactETHForTokens(amountOutMin, path, msg.sender, block.timestamp.add(1), set);
	}

	function swapOnUniswap(address token, uint256 amountIn, uint256 amountOutMin) public {
		address[] memory path;
		if (token == s.c.weth) {
			path = new address[](2);
			path[0] = s.c.weth;
			path[1] = s.c.bean;
		}
		else {
			path = new address[](3);
			path[0] = token;
			path[1] = s.c.weth;
			path[2] = s.c.bean;
		}
		Storage.Settings memory set;
		set.toInternalBalance = true;
		set.fromInternalBalance = true;
		set.lightUpdateSilo = false;
		LibUniswap.swapExactTokensForTokens(amountIn, amountOutMin, path, msg.sender, block.timestamp.add(1), set, false);
	}

	function addLiquidityOnUniswap(uint256 amountADesired, uint256 amountBDesired, uint256 amountAMin, uint256 amountBMin) public {
		LibUniswap.addLiquidity(s.c.bean, s.c.weth, amountADesired, amountBDesired, amountAMin, amountBMin, msg.sender, block.timestamp.add(1), false);
	}
	
	function addLiquidityETHOnUniswap(uint256 amountTokenDesired, uint256 amountTokenMin, uint256 amountETHMin) public payable {
		LibUniswap.addLiquidityETH(s.c.bean, amountTokenDesired, amountTokenMin, amountETHMin, msg.sender, block.timestamp.add(1), false);
	}

	function removeLiquidityOnUniswap(uint256 liquidity, uint256 amountAMin, uint256 amountBMin) public {
		LibUniswap.removeLiquidity(s.c.bean, s.c.weth, liquidity, amountAMin, amountBMin, msg.sender, block.timestamp.add(1), false);
	}
	
	function removeLiquidityETHOnUniswap(uint256 liquidity, uint256 amountTokenMin, uint256 amountETHMin) public {
		LibUniswap.removeLiquidityETH(s.c.bean, liquidity, amountTokenMin, amountETHMin, msg.sender, block.timestamp.add(1));
	}
}
