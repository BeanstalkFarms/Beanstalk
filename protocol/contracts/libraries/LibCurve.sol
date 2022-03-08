/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import '../interfaces/IMeta3Curve.sol';
import '../interfaces/IToken3Curve.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import 'hardhat/console.sol';

/* 
 * Author: Beasley
 * LibCurve is the "router" for the Curve Pools
*/

library LibCurve {

	using SafeMath for uint256;

	address private constant BEAN3CRV = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);
	address private constant METACRV = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
	address private constant LUSD3CRV = address(0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA);

	address private constant DAI = address(0x6B175474E89094C44Da98b954EedeAC495271d0F);
	address private constant BEAN = address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db);

	function swapLUSDForBeans(uint256 amount, uint256 minEndAmount) internal returns (uint256 amountReturned) {
		uint256 dai = IERC20(DAI).balanceOf(address(this)); // Using address(this) instead of msg.sender to avoid paying more for approvals
		IToken3Curve(LUSD3CRV).exchange(0, 1, amount, minEndAmount);
		dai = IERC20(DAI).balanceOf(address(this)).sub(dai);
		amountReturned = IERC20(BEAN).balanceOf(address(this));
		IToken3Curve(BEAN3CRV).exchange(1, 0, dai, minEndAmount);
		amountReturned = IERC20(BEAN).balanceOf(address(this)).sub(amountReturned);
		require(amountReturned != 0 && amountReturned != IERC20(BEAN).balanceOf(address(this)), "LibCurve: Exchange failed");
	}
}
