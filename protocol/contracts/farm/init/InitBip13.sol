/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../AppStorage.sol";

/**
 * @author Beasley
 * @title InitBip13 whitelists basic functions for LiquityFacet
**/

contract InitBip12 {

	bytes4 constant private sowBeans = 0x52719789;
	bytes4 constant private depositBeans = 0x75ce258d;
	bytes4 constant private fundraise = 0x2db75d40;
	bytes4 constant private unwrapBeans = 0x45867952;
		
	AppStorage internal s;

	function init() external {
		s.whitelistedFunction[sowBeans] = true;
		s.whitelistedFunction[depositBeans] = true;
		s.whitelistedFunction[fundraise] = true;
		s.whitelistedFunction[unwrapBeans] = true;
	}
}
