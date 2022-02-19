/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../../../libraries/LibLiquity.sol';
import '../../AppStorage.sol';
import './LiquityFactory.sol';
import '../../../interfaces/ILiquityManager.sol';
import '../../../libraries/LibUserBalance.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

import 'hardhat/console.sol';

/**
 * @author Beasley
 * @title Users lend on Liquity for BEAN
**/
contract Designate is LiquityFactory {

	using SafeMath for uint256;

	/*
	 * Setup
	*/

	// Addresses are internal for MockFacets
    	address internal constant borrowerOperations = address(0x24179CD81c9e782A4096035f7eC97fB8B783e007);
    	address internal constant troveManager = address(0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2);
    	address internal constant lusdToken = address(0x5f98805A4E8be255a32880FDeC7F6728C6568bA0);
    	address internal constant sortedTroves = address(0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6);
    	address internal constant activePool = address(0xDf9Eb223bAFBE5c5271415C75aeCD68C21fE3D7F);
    	address internal constant priceFeed = address(0x4c517D4e2C851CA76d7eC94B805269Df0f2201De);

	AppStorage internal s;

	/*
	 * Helper Functions
	*/
	
	function _collateralizeAndSwap(uint256 maxFeePercentage, uint256 lusdAmount, uint256 minBeanAmount, uint256 numTrials, uint256 randSeed, Storage.Settings calldata set) internal returns (uint256 newBeans) {
		_collateralizeWithApproxHint(maxFeePercentage, lusdAmount, numTrials, randSeed);
		address[] memory path = new address[](3);
		path[0] = lusdToken;
		path[1] = s.c.weth;
		path[2] = s.c.bean;
		console.log('here');
		uint256[] memory amounts = LibUniswap.swapExactTokensForTokens(lusdAmount, minBeanAmount, path, address(this), block.timestamp.add(1), set, false);
		console.log("Amounts 0: %s", amounts[0]);
		console.log("Amounts 1: %s", amounts[1]);
		console.log("Amounts 2: %s", amounts[2]);
	}

	function _fetchBeans(uint256 fetchAmount, bool fromInternalBalance) internal {
		if (fromInternalBalance) {
			uint256 fromInternal = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(s.c.bean), fetchAmount, true);
			if (fromInternal != fetchAmount) IBean(s.c.bean).transferFrom(msg.sender, address(this), fetchAmount.sub(fromInternal));
		}
		else IBean(s.c.bean).transferFrom(msg.sender, address(this), fetchAmount);
	}		

	/*
	 * Trove Functions
	*/

	function _collateralizeWithApproxHint(uint256 minFee, uint256 lusdAmount, uint256 numTrials, uint256 randSeed) internal {
	   	if (s.trove[msg.sender] == address(0)) s.trove[msg.sender] = createTroveContract(msg.sender);
	   	ILiquityManager(s.trove[msg.sender]).collateralizeWithApproxHint{value: msg.value}(minFee, lusdAmount, numTrials, randSeed);
	   	LibUserBalance._increaseInternalBalance(msg.sender, IERC20(lusdToken), lusdAmount);
   	}

   	function _repayDebt(uint256 lusdAmount, uint256 numTrials, uint256 randSeed) internal {
	   	require(s.trove[msg.sender] != address(0), "LiquityFacet: User has no trove");
	   	SafeERC20.safeTransfer(IERC20(lusdToken), s.trove[msg.sender], lusdAmount);
	   	ILiquityManager(s.trove[msg.sender]).repayDebt(lusdAmount, numTrials, randSeed);
   	}

	function liquityManager() public returns (ILiquityManager) {
		return ILiquityManager(s.trove[msg.sender]);
	}
}

