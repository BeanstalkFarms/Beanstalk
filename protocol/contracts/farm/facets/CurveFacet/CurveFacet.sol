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

	function swapOnCurve(uint256 startingAmount, uint256 minEndAmount, uint8 fromToken, uint8 toToken, address poolAddress) public payable {
		LibCurve.swapOnCurve(startingAmount, minEndAmount, fromToken, toToken, poolAddress);
	}

	function addLiquidityCurve(uint256[] calldata amounts, uint256 minMintAmount, address poolAddress) public payable {
		LibCurve.addLiquidity(amounts, minMintAmount, poolAddress);
	}
}

