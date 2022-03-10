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

	address private constant BEAN3CRV = address(0x3a70DfA7d2262988064A2D051dd47521E43c9BdD);
	address private constant METACRV = address(0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7);
	address private constant LUSD3CRV = address(0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA);

	AppStorage internal s;

	function swapOnCurve(uint256 startingAmount, uint256 minEndAmount, LibCurve.CurveData calldata crvd) public returns (uint256) {
		return LibCurve.swapOnCurve(startingAmount, minEndAmount, crvd);
	}

}

