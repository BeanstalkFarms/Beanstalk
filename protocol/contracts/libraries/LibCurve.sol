/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import { SafeMath } from "@openzeppelin/contracts/math/SafeMath.sol";
import '../interfaces/IMeta3Curve.sol';
import '../interfaces/IToken3Curve.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

/* 
 * Author: Beasley
 * LibCurve is the "router" for the Curve Pools
*/

library LibCurve {

	struct CurveData {
		address poolAddress;
		address tokenAddress;
		uint8 swapTokenIndex;
	}

	using SafeMath for uint256;

	address private constant BEAN3CRV = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);
	address private constant METACRV = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
	address private constant LUSD3CRV = address(0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA);

	address private constant BEAN = address(0xDC59ac4FeFa32293A95889Dc396682858d52e5Db);

	function swapOnCurve(uint256 startingAmount, uint256 minEndAmount, CurveData calldata crvd) internal returns (uint256 amountReturned) {
		uint256 tok = IERC20(crvd.tokenAddress).balanceOf(address(this)); // Using address(this) instead of msg.sender to avoid paying more for approvals
		IToken3Curve(crvd.poolAddress).exchange(0, crvd.swapTokenIndex, startingAmount, minEndAmount);
		tok = IERC20(crvd.tokenAddress).balanceOf(address(this)).sub(tok);
		uint256 snapshot = IERC20(BEAN).balanceOf(address(this));
		IToken3Curve(BEAN3CRV).exchange(crvd.swapTokenIndex, 0, tok, minEndAmount);
		amountReturned = IERC20(BEAN).balanceOf(address(this)).sub(snapshot);
		require(amountReturned != 0, "LibCurve: Exchange failed");
	}
}
