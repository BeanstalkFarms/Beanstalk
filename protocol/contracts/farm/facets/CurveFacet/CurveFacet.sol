/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../../../libraries/LibCurve.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '../../AppStorage.sol';

/**
 * @author Beasley
 * @title Users call generalized curve functions from LibCurve (for farm facet)
**/

contract CurveFacet {

	AppStorage internal s;

	function swapBeanLusd(uint256 startingAmount, uint256 minEndAmount, uint8 fromToken, uint8 toToken, address swapToken) public payable returns (uint256 amountReturned) {
		amountReturned = LibCurve.swapBeanLusd(startingAmount, minEndAmount, fromToken, toToken, swapToken);
	}

	function addLiquidityBeanLusd(uint256[2] calldata amounts, uint256 minMintAmount, address[2] calldata tokens) public payable returns (uint256 LPReturned) {
		LPReturned = LibCurve.addLiquidityBeanLusd(amounts, minMintAmount, tokens);
	}

	function swapBean3Curve(uint256 startingAmount, uint256 minEndAmount, uint8 fromToken, uint8 toToken, address swapToken) public payable returns (uint256 amountReturned) {
		amountReturned = LibCurve.swapBean3Curve(startingAmount, minEndAmount, fromToken, toToken, swapToken);
	}

	function addLiquidityBean3Curve(uint256[4] calldata amounts, uint256 minMintAmount, address[4] calldata tokens) public payable returns (uint256 LPReturned) {
		LPReturned = LibCurve.addLiquidityBean3Curve(amounts, minMintAmount, tokens);
	}

}

