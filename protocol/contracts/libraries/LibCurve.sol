/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import { IBeanLusdCurve } from '../interfaces/IBeanLusdCurve.sol';
import { IBean3Curve } from '../interfaces/IBean3Curve.sol';
import { ICurve } from '../interfaces/ICurve.sol';

import { IERC20 } from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import 'hardhat/console.sol';

/* 
 * Author: Beasley
 * LibCurve is the "router" for the Curve Pools
*/

library LibCurve {

	using SafeMath for uint256;

	address private constant BEANLUSD = address(0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D);
	address private constant META3CRV = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);

	/*
	* BEAN/LUSD Pool
       */

	function swapBeanLusd(uint256 startingAmount, uint256 minEndAmount, uint8 fromToken, uint8 toToken, address swapToken) internal returns (uint256 amountReturned) {
		IERC20(swapToken).transferFrom(msg.sender, address(this), startingAmount);
		amountReturned = IBeanLusdCurve(BEANLUSD).exchange(fromToken, toToken, startingAmount, minEndAmount);
	}

	function addLiquidityBeanLusd(uint256[2] calldata amounts, uint256 minEndAmount, address[2] calldata tokens) internal returns (uint256 LPReturned) {
		if (amounts[0] != 0) IERC20(tokens[0]).transferFrom(msg.sender, address(this), amounts[0]);
		if (amounts[1] != 0) IERC20(tokens[1]).transferFrom(msg.sender, address(this), amounts[1]);
		LPReturned = IBeanLusdCurve(BEANLUSD).add_liquidity(amounts, minEndAmount);
	}

	/*
	* BEAN/META3
       */

	function swapBean3Curve(uint256 startingAmount, uint256 minEndAmount, uint8 fromToken, uint8 toToken, address swapToken) internal returns (uint256 amountReturned) {
		IERC20(swapToken).transferFrom(msg.sender, address(this), startingAmount);
		amountReturned = IBean3Curve(META3CRV).exchange(fromToken, toToken, startingAmount, minEndAmount);
	}

	function addLiquidityBean3Curve(uint256[4] calldata amounts, uint256 minEndAmount, address[4] calldata tokens) internal returns (uint256 LPReturned) {
		if (amounts[0] != 0) IERC20(tokens[0]).transferFrom(msg.sender, address(this), amounts[0]);
		if (amounts[1] != 0) IERC20(tokens[1]).transferFrom(msg.sender, address(this), amounts[1]);
		if (amounts[2] != 0) IERC20(tokens[2]).transferFrom(msg.sender, address(this), amounts[2]);
		if (amounts[3] != 0) IERC20(tokens[3]).transferFrom(msg.sender, address(this), amounts[3]);
		LPReturned = IBean3Curve(META3CRV).add_liquidity(amounts, minEndAmount);
	}

	/*
	* Generalized
       */

        function swapOnCurve(uint256 startingAmount, uint256 minEndAmount, uint8 fromToken, uint8 toToken, address poolAddress, address swapToken) internal returns (uint256 amountReturned) {
		IERC20(swapToken).transferFrom(msg.sender, address(this), startingAmount);
		amountReturned = ICurve(poolAddress).exchange(fromToken, toToken, startingAmount, minEndAmount);
	}

	function addLiquidityCurve(uint256[] calldata amounts, uint256 minEndAmount, address poolAddress, address[] calldata tokens) internal returns (uint256 LPReturned) {
		for (uint8 i = 0; i < tokens.length; i++) {
			if (amounts[i] > 0) IERC20(tokens[i]).transferFrom(msg.sender, address(this), amounts[i]);
		}
		LPReturned = ICurve(poolAddress).add_liquidity(amounts, minEndAmount);
	}
}
