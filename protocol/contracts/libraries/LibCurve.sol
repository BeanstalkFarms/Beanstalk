/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import '../interfaces/IMeta3Curve.sol';
import '../interfaces/ICurve.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import 'hardhat/console.sol';

/* 
 * Author: Beasley
 * LibCurve is the "router" for the Curve Pools
*/

library LibCurve {

	using SafeMath for uint256;
	address private constant BEAN = address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db);
	
	function swapOnCurve(uint256 startingAmount, uint256 minEndAmount, uint8 fromToken, uint8 toToken, address poolAddress) internal returns (uint256 amountReturned) {
		console.log(ICurve(poolAddress).decimals());
		ICurve(poolAddress).exchange(fromToken, toToken, startingAmount, minEndAmount, msg.sender);
	}

	function addLiquidity(uint256[] calldata amounts, uint256 minEndAmount, address poolAddress) internal {
		ICurve(poolAddress).add_liquidity(amounts, minEndAmount);
	}
}
