/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import './Designate.sol';
import '../../../libraries/LibDirect.sol';

/**
 * @author Beasley
 * @title Users lend on Liquity for BEAN
**/
contract LiquityFacet is Designate {

    	using SafeMath for uint256;

    	/*
     	* Generalized Functions
    	*/

  	function collateralizeAndSwap(
		uint256 maxFeePercentage, 
		uint256 lusdAmount, 
		uint256 beanAmount, 
		uint256 minBeanAmount, 
		uint256 numTrials, 
		uint256 randSeed, 
		Storage.Settings calldata set
	) public payable {	
	}

	/*
	 * Specific Functions
	*/
}
