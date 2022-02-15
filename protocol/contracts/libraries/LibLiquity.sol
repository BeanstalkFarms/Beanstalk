/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../interfaces/Liquity/IBorrowerOperations.sol';
import '../interfaces/Liquity/ISortedTroves.sol';
import '../interfaces/Liquity/ITroveManager.sol';
import '../interfaces/Liquity/IActivePool.sol';
import '../interfaces/Liquity/IPriceFeed.sol';
import '../interfaces/Liquity/ILUSDToken.sol';

import '../interfaces/IBean.sol';

import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import "./LibAppStorage.sol";
import './LibUniswap.sol';
import './LibUserBalance.sol';

import 'hardhat/console.sol';

/*
 ** @author: Beasley
 ** @title: Helper functions to interact with Liquity
*/

library LibLiquity {

	using SafeMath for uint256;

	/*
	 * Liquity Data
	*/ 

	event OpenTrove(uint maxFeePercentage, uint LUSDAmount, address upperHint, address lowerHint);

	uint internal constant NICR_PRECISION = 1e20;

	IBorrowerOperations private constant borrowerOperations = IBorrowerOperations(address(0x24179CD81c9e782A4096035f7eC97fB8B783e007));
	ITroveManager private constant troveManager = ITroveManager(address(0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2));
	ILUSDToken private constant lusdToken = ILUSDToken(address(0x5f98805A4E8be255a32880FDeC7F6728C6568bA0));
	ISortedTroves private constant sortedTroves = ISortedTroves(address(0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6));
	IActivePool private constant activePool = IActivePool(address(0xDf9Eb223bAFBE5c5271415C75aeCD68C21fE3D7F));
	IPriceFeed private constant priceFeed = IPriceFeed(address(0x4c517D4e2C851CA76d7eC94B805269Df0f2201De));
	
	/*
	* Functions for chaining
        */ 

        function collateralizeAndAct(
		uint256 maxFeePercentage, 
		uint256 lusdWithdrawAmount, 
		uint256 beanAmount, 
		uint256 minBeanAmount, 
		uint256 numTrials,
		uint256 randSeed, 
		bytes4 functionSelector, 
		bytes[] calldata functionArgs, 
		Storage.Settings calldata set
	) internal {
       		collateralizeWithApproxHint(maxFeePercentage, lusdWithdrawAmount, numTrials, randSeed);
		AppStorage storage s = LibAppStorage.diamondStorage();
		address[] memory path = new address[](3);
		path[0] = address(lusdToken);
		path[1] = s.c.weth;
		path[2] = s.c.bean;
		uint256 beanSnapshot = IBean(s.c.bean).balanceOf(address(this)).add(IBean(s.c.bean).balanceOf(msg.sender));
		LibUniswap.swapExactTokensForTokens(lusdWithdrawAmount, minBeanAmount, path, address(this), block.timestamp.add(1), set, false);
		uint256 swappedBeans = (IBean(s.c.bean).balanceOf(address(this)).add(IBean(s.c.bean).balanceOf(msg.sender))).sub(beanSnapshot);
		if (beanAmount <= swappedBeans) { // **This condition triggers when the user wishes to allocate less beans than he/she obtained through the collateralization**
			directFunds(beanAmount, functionSelector, functionArgs);
			if (set.toInternalBalance) {
				LibUserBalance._increaseInternalBalance(msg.sender, IBean(s.c.bean), swappedBeans.sub(beanAmount));
			}
			else {
				IBean(s.c.bean).transfer(msg.sender, swappedBeans.sub(beanAmount));
			}
		}
		else {  // **This condidtion triggers when the user wishes to allocate more beans than he/she obtained through the collateralization and thus needs beans taken from their wallet**
			if (set.fromInternalBalance) {
				if (s.internalTokenBalance[msg.sender][IERC20(s.c.bean)] <= beanAmount.sub(swappedBeans)) {
					IBean(s.c.bean).transferFrom(msg.sender, address(this), (beanAmount.sub(swappedBeans)).sub(s.internalTokenBalance[msg.sender][IERC20(s.c.bean)]));
					LibUserBalance._decreaseInternalBalance(msg.sender, IBean(s.c.bean), beanAmount.sub(swappedBeans), true);
				}
				else LibUserBalance._decreaseInternalBalance(msg.sender, IBean(s.c.bean), beanAmount.sub(swappedBeans), false);
			}
			else IBean(s.c.bean).transferFrom(msg.sender, address(this), beanAmount.sub(swappedBeans));
			directFunds(beanAmount, functionSelector, functionArgs);
		}		
	}

	/*
	* Base control flow functions
        */

	// For less gas fees, use this function to approximate a trove by using a random seed number: See -> https://github.com/liquity/dev#supplying-hints-to-trove-operations
	// Random seed should be implemented front-end
	function collateralizeWithApproxHint(uint256 maxFeePercentage, uint256 lusdWithdrawAmount, uint256 numTrials, uint256 randSeed) internal {
		AppStorage storage s = LibAppStorage.diamondStorage();
		if (!s.sl.active[msg.sender]) { // Default value for bool is 0 or false
			require(msg.value > 0, "Cannot open trove with no collateral.");
			if (sortedTroves.getSize() == 0) {
				(bool success,) = address(borrowerOperations).delegatecall(abi.encodeWithSignature("openTrove(uint256,uint256,address,address)", maxFeePercentage, lusdWithdrawAmount, msg.sender, msg.sender));
				require(success, "LibLiquity: Failed to open trove.");
			}
			else {
				(address lowerHint, address upperHint) = setHintsRandom(lusdWithdrawAmount, numTrials, randSeed);
				(bool success,) = address(borrowerOperations).delegatecall(
					abi.encodeWithSignature("openTrove(uint256,uint256,address,address)", maxFeePercentage, lusdWithdrawAmount, lowerHint, upperHint)
				);
				require(success, "LibLiquity: Failed to open trove.");
			}
			s.sl.active[msg.sender] = true;
		}
		else {
			(address lowerHint, address upperHint) = setHintsRandom(lusdWithdrawAmount, numTrials, randSeed);
			if (msg.value > 0) {
				(bool success,) = address(borrowerOperations).delegatecall(abi.encodeWithSignature("addColl(address,address)", lowerHint, upperHint));
				require(success, "LibLiquity: Failed to add collateral.");
				if (lusdWithdrawAmount > 0) {
					(success,) = address(borrowerOperations).delegatecall(
						abi.encodeWithSignature("withdrawLUSD(uint256,uint256,address,address)", maxFeePercentage, lusdWithdrawAmount, lowerHint, upperHint)
					);
					require(success, "LibLiquity: Failed to withdraw LUSD.");
				}
			}
			else {
				(bool success,) = address(borrowerOperations).delegatecall(
					abi.encodeWithSignature("withdrawLUSD(uint256,uint256,address,address)", maxFeePercentage, lusdWithdrawAmount, lowerHint, upperHint)
				);
				require(success, "LibLiquity: Failed to withdraw LUSD.");
			}
		}
		LibUserBalance._increaseInternalBalance(msg.sender, IERC20(lusdToken), lusdWithdrawAmount);
	}


	// This function will allow users to allocate their lusd and beans into any Beanstalk function
	function directFunds(uint256 beanAmount, bytes4 functionSelector, bytes[] calldata functionArgs) internal {
		(bool success,) = address(this).delegatecall(abi.encodeWithSelector(functionSelector, functionArgs));
		require(success, "LibLiquity: function call failed.");
	}

	// This allows users to close/remove some eth some their trove by sending in LUSD
	function repayDebt(uint256 lusdAmount, uint256 numTrials, uint256 randSeed) internal {
		AppStorage storage s = LibAppStorage.diamondStorage();
		if (lusdAmount >= s.sl.lusdBalance[msg.sender]) {
			LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(lusdToken), lusdAmount, true);
			(bool success,) = address(borrowerOperations).delegatecall(abi.encodeWithSignature("closeTrove()"));
			require(success, "LibLiquity: Failed to close trove.");
		}
		else {
			LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(lusdToken), lusdAmount, false);
			(address lowerHint, address upperHint) = setHintsRandom(lusdAmount, numTrials, randSeed);
			(bool success,) = address(borrowerOperations).delegatecall(abi.encodeWithSignature("repayLUSD(uint256,address,address)", lusdAmount, lowerHint, upperHint));
			require(success, "LibLiquity: Failed to close trove.");
		}
	}

	/*
	 * Hint Helper
	*/

       function getApproxHint(uint _CR, uint _numTrials, uint _inputRandomSeed)
        internal
        view
        returns (address hintAddress, uint diff, uint latestRandomSeed)
    {
	AppStorage storage s = LibAppStorage.diamondStorage();
       	uint arrayLength = troveManager.getTroveOwnersCount();

        if (arrayLength == 0) {
        	return (address(0), 0, _inputRandomSeed);
        }

        hintAddress = sortedTroves.getLast();
        diff = _getAbsoluteDifference(_CR, troveManager.getNominalICR(hintAddress));
        latestRandomSeed = _inputRandomSeed;

        uint i = 1;

        while (i < _numTrials) {
            latestRandomSeed = uint(keccak256(abi.encodePacked(latestRandomSeed)));

            uint arrayIndex = latestRandomSeed % arrayLength;
            address currentAddress = troveManager.getTroveFromTroveOwnersArray(arrayIndex);
            uint currentNICR = troveManager.getNominalICR(currentAddress);

            // check if abs(current - CR) > abs(closest - CR), and update closest if current is closer
            uint currentDiff = _getAbsoluteDifference(currentNICR, _CR);

            if (currentDiff < diff) {
                diff = currentDiff;
                hintAddress = currentAddress;
            }
            i++;
        }
    }
        function setHintsRandom(uint256 lusdAmount, uint256 numTrials, uint256 randSeed) private returns (address, address) {
		(address approxHint,,) = getApproxHint(_computeNominalCR(msg.value, lusdAmount), numTrials, randSeed);
		return sortedTroves.findInsertPosition(_computeNominalCR(msg.value, lusdAmount), approxHint, approxHint);
	}

	/*
	 * Liquity Math
        */

	function _computeNominalCR(uint _coll, uint _debt) internal pure returns (uint) {
        	if (_debt > 0) {
            		return _coll.mul(NICR_PRECISION).div(_debt);
        		}
        // Return the maximal value for uint256 if the Trove has a debt of 0. Represents "infinite" CR.
        	else { // if (_debt == 0)
            		return 2**256 - 1;
        	}
    	}

	function _getAbsoluteDifference(uint _a, uint _b) internal pure returns (uint) {
        	return (_a >= _b) ? _a.sub(_b) : _b.sub(_a);
    	}
}
