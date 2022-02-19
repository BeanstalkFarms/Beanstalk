/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import './Designate.sol';
import '../../../libraries/LibDirect.sol';

import 'hardhat/console.sol';

/**
 * @author Beasley
 * @title Users lend on Liquity for BEAN
**/
contract LiquityFacet is Designate {

    	using SafeMath for uint256;

    	/*
     	* Generalized Functions
    	*/

  	function collateralizeAndAct(
		uint256 maxFeePercentage, 
		uint256 lusdAmount, 
		uint256 beanAmount, 
		uint256 minBeanAmount, 
		uint256 numTrials, 
		uint256 randSeed, 
		bytes4 functionSelector,
		bytes[] calldata functionArgs,
		Storage.Settings calldata set
	) public payable {
	}

	/*
	 * Specific Functions
	*/

        function collateralizeAndSowBeans(
		uint256 maxFeePercentage, 
		uint256 lusdAmount, 
		uint256 beanAmount, 
		uint256 minBeanAmount, 
		uint256 numTrials, 
		uint256 randSeed, 
		Storage.Settings calldata set
	) public payable {
		uint256 swappedBeans = _collateralizeAndSwap(maxFeePercentage, lusdAmount, minBeanAmount, numTrials, randSeed, set);
		if (swappedBeans < beanAmount) _fetchBeans(beanAmount.sub(swappedBeans), set.fromInternalBalance);
		address(this).delegatecall(abi.encodeWithSignature("sowBeans(uint256)", beanAmount));
	}

	function collateralizeAndDeposit(
		uint256 maxFeePercentage, 
		uint256 lusdAmount, 
		uint256 beanAmount, 
		uint256 minBeanAmount, 
		uint256 numTrials, 
		uint256 randSeed, 
		Storage.Settings calldata set
	) public payable {
		uint256 swappedBeans = _collateralizeAndSwap(maxFeePercentage, lusdAmount, minBeanAmount, numTrials, randSeed, set);
		if (swappedBeans < beanAmount) _fetchBeans(beanAmount.sub(swappedBeans), set.fromInternalBalance);
		address(this).delegatecall(abi.encodeWithSignature("depositBeans(uint256)", beanAmount));
	}

	function collateralizeAndFundraise(
		uint256 maxFeePercentage, 
		uint256 lusdAmount, 
		uint256 beanAmount, 
		uint256 minBeanAmount, 
		uint32 id,
		uint256 numTrials, 
		uint256 randSeed, 
		Storage.Settings calldata set
	) public payable {
		uint256 swappedBeans = _collateralizeAndSwap(maxFeePercentage, lusdAmount, minBeanAmount, numTrials, randSeed, set);
		if (swappedBeans < beanAmount) _fetchBeans(beanAmount.sub(swappedBeans), set.fromInternalBalance);
		address(this).delegatecall(abi.encodeWithSignature("fund(uint32,uint256)", id, beanAmount));
	}

	function collateralizeAndUnwrap(
		uint256 maxFeePercentage, 
		uint256 lusdAmount, 
		uint256 beanAmount, 
		uint256 minBeanAmount, 
		uint256 numTrials, 
		uint256 randSeed, 
		Storage.Settings calldata set
	) public payable {
		uint256 swappedBeans = _collateralizeAndSwap(maxFeePercentage, lusdAmount, minBeanAmount, numTrials, randSeed, set);
		if (swappedBeans < beanAmount) _fetchBeans(beanAmount.sub(swappedBeans), set.fromInternalBalance);
		address(this).delegatecall(abi.encodeWithSignature("wrapBeans(uint256)", beanAmount));
	}



}
