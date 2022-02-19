/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../../../libraries/LibLiquity.sol';
import '../../../interfaces/ILiquityManager.sol';
import '../../../interfaces/IBean.sol';
import '../../../libraries/LibLiquity.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

/* @author Beasley
 * @title Users lend on Liquity for BEAN
**/

contract LiquityManager is ILiquityManager {

	using SafeMath for uint256;

	/*
	 * Events
	*/ 

        event Fallback(address indexed caller, uint256 value);

	/*
	 * Contract Data
	*/

	IBorrowerOperations private constant borrowerOperations = IBorrowerOperations(address(0x24179CD81c9e782A4096035f7eC97fB8B783e007));
	ITroveManager private constant troveManager = ITroveManager(address(0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2));
	ILUSDToken private constant lusdToken = ILUSDToken(address(0x5f98805A4E8be255a32880FDeC7F6728C6568bA0));
	ISortedTroves private constant sortedTroves = ISortedTroves(address(0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6));
	IActivePool private constant activePool = IActivePool(address(0xDf9Eb223bAFBE5c5271415C75aeCD68C21fE3D7F));
	IPriceFeed private constant priceFeed = IPriceFeed(address(0x4c517D4e2C851CA76d7eC94B805269Df0f2201De));

	bool private active;

	/*
	 * General Functions
	*/

	function collateralizeWithApproxHint(uint256 maxFeePercentage, uint256 lusdWithdrawAmount, uint256 numTrials, uint256 randSeed) external payable override {
		if (!active) { // Default value for bool is 0 or false
			require(msg.value > 0, "Cannot open trove with no collateral.");
			if (sortedTroves.getSize() == 0) {
				borrowerOperations.openTrove{value: msg.value}(maxFeePercentage, lusdWithdrawAmount, address(this), address(this));
			}
			else {
				(address lowerHint, address upperHint) = LibLiquity.findHints(lusdWithdrawAmount, numTrials, randSeed);
				borrowerOperations.openTrove{value: msg.value}(maxFeePercentage, lusdWithdrawAmount, lowerHint, upperHint);
			}
			active = true;
		}
		else {
			(address lowerHint, address upperHint) = LibLiquity.findHints(lusdWithdrawAmount, numTrials, randSeed);
			if (msg.value > 0) {
				borrowerOperations.addColl{value: msg.value}(lowerHint, upperHint);
				if (lusdWithdrawAmount > 0) {
					(lowerHint, upperHint) = LibLiquity.findHints(lusdWithdrawAmount, numTrials, randSeed);
					borrowerOperations.withdrawLUSD(maxFeePercentage, lusdWithdrawAmount, lowerHint, upperHint);
				}
			}
			else {
				borrowerOperations.withdrawLUSD(maxFeePercentage, lusdWithdrawAmount, lowerHint, upperHint);
			}
		}
		SafeERC20.safeTransfer(IERC20(lusdToken), msg.sender, lusdWithdrawAmount); 
	}

	// Must transfer LUSD to this contract first
	function repayDebt(uint256 lusdAmount, uint256 numTrials, uint256 randSeed) external payable override returns (uint256 excessLUSD) {
		uint256 troveDebt = troveManager.getTroveDebt(address(this));
		if (lusdAmount >= troveDebt) {
			if (lusdAmount > troveDebt) excessLUSD = lusdAmount.sub(troveDebt);
			borrowerOperations.closeTrove();
			active = false;
		}
		else {
			(address lowerHint, address upperHint) = LibLiquity.findHints(lusdAmount, numTrials, randSeed);
			borrowerOperations.repayLUSD(lusdAmount, lowerHint, upperHint);
		}
	}

	/* 
	 * Fallback function for callbacks from ActivePool.sol
	*/ 

	fallback() external payable {
		emit Fallback(msg.sender, msg.value);
	}
}
