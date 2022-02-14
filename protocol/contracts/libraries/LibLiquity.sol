/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../interfaces/Liquity/IBorrowerOperations.sol';
import '../interfaces/Liquity/ISortedTroves.sol';
import '../interfaces/Liquity/ITroveManager.sol';
import "./LibAppStorage.sol";
import '@openzeppelin/contracts/math/SafeMath.sol';
import './LibUniswap.sol';
import '../interfaces/IBean.sol';

library LibLiquity {

	using SafeMath for uint256;

	event OpenTrove(uint maxFeePercentage, uint LUSDAmount, address upperHint, address lowerHint);

	uint internal constant NICR_PRECISION = 1e20;

	address private constant borrowerOperations = address(0x24179CD81c9e782A4096035f7eC97fB8B783e007);
	address private constant troveManager = address(0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2);
	address private constant lusdToken = address(0x5f98805A4E8be255a32880FDeC7F6728C6568bA0);
	address private constant sortedTroves = address(0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6);

	/*
	* Functions for chaining
        */ 

        function collateralizeConvertAndAct(uint256 maxFeePercentage, uint256 lusdWithdrawAmount, uint256 beanAmount, uint256 minBeanAmount, bytes4 functionSelector, bytes[] calldata functionArgs, Storage.Settings calldata set) internal {
       		uint256 boughtLUSD = collateralize(maxFeePercentage, lusdWithdrawAmount);
		AppStorage storage s = LibAppStorage.diamondStorage();
		address[] memory path = new address[](3);
		path[0] = lusdToken;
		path[1] = s.c.weth;
		path[2] = s.c.bean;
		uint256 beanSnapshot = IBean(s.c.bean).balanceOf(address(this)).add(IBean(s.c.bean).balanceOf(msg.sender));
		LibUniswap.swapExactTokensForTokens(boughtLUSD, minBeanAmount, path, address(this), block.timestamp.add(1), set, false);
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

	// Funtion will allow user to deposit ETH into an existing Liquity trove/create a new trove.
	// The functions that call this function must be payable.
	function collateralize(uint256 maxFeePercentage, uint256 lusdWithdrawAmount) internal returns (uint256) {
		AppStorage storage s = LibAppStorage.diamondStorage();
		uint256 snapshot = IERC20(lusdToken).balanceOf(address(this));
		if (!s.sl.active[msg.sender]) { // Default value for bool is 0 or false
			if (ISortedTroves(sortedTroves).getSize() == 0) IBorrowerOperations(borrowerOperations).openTrove(maxFeePercentage, lusdWithdrawAmount, msg.sender, msg.sender);
			else {
				(s.sl.lowerHint[msg.sender], s.sl.upperHint[msg.sender]) = ISortedTroves(sortedTroves).findInsertPosition(_computeNominalCR(msg.value, lusdWithdrawAmount), ISortedTroves(sortedTroves).getFirst(), ISortedTroves(sortedTroves).getLast());
				IBorrowerOperations(borrowerOperations).openTrove(maxFeePercentage, lusdWithdrawAmount, s.sl.lowerHint[msg.sender], s.sl.upperHint[msg.sender]);
			}
			s.sl.lusdBalance[msg.sender] = s.sl.lusdBalance[msg.sender].add(lusdWithdrawAmount);
			s.sl.active[msg.sender] == true;
		}
		else {
			IBorrowerOperations(borrowerOperations).addColl(s.sl.lowerHint[msg.sender], s.sl.upperHint[msg.sender]); // Check if this operation should adjust the trove upper and lower hints
			IBorrowerOperations(borrowerOperations).withdrawLUSD(maxFeePercentage, lusdWithdrawAmount, s.sl.lowerHint[msg.sender], s.sl.upperHint[msg.sender]);
		}
		return IERC20(lusdToken).balanceOf(address(this)).sub(snapshot); // This is amount received post 200LUSD deposit/fee
	}

	// For less gas fees, use this function to approximate a trove by using a random seed number: See -> https://github.com/liquity/dev#supplying-hints-to-trove-operations
	// Random seed should be implemented front-end
	function collateralizeWithApproxHint(uint256 maxFeePercentage, uint256 lusdWithdrawAmount, uint256 numTrials, uint256 randSeed) internal returns (uint256) {
		AppStorage storage s = LibAppStorage.diamondStorage();
		uint256 snapshot = IERC20(lusdToken).balanceOf(address(this));
		if (!s.sl.active[msg.sender]) { // Default value for bool is 0 or false
			if (ISortedTroves(sortedTroves).getSize() == 0) IBorrowerOperations(borrowerOperations).openTrove(maxFeePercentage, lusdWithdrawAmount, msg.sender, msg.sender);
			else {
				(address approxHint,,) = getApproxHint(_computeNominalCR(msg.value, lusdWithdrawAmount), numTrials, randSeed);
				(s.sl.lowerHint[msg.sender], s.sl.upperHint[msg.sender]) = ISortedTroves(sortedTroves).findInsertPosition(_computeNominalCR(msg.value, lusdWithdrawAmount), approxHint, approxHint);
				IBorrowerOperations(borrowerOperations).openTrove(maxFeePercentage, lusdWithdrawAmount, s.sl.lowerHint[msg.sender], s.sl.upperHint[msg.sender]);
			}
			s.sl.lusdBalance[msg.sender] = s.sl.lusdBalance[msg.sender].add(lusdWithdrawAmount);
			s.sl.active[msg.sender] == true;
		}
		else {
			IBorrowerOperations(borrowerOperations).addColl(s.sl.lowerHint[msg.sender], s.sl.upperHint[msg.sender]); // Check if this operation should adjust the trove upper and lower hints
			IBorrowerOperations(borrowerOperations).withdrawLUSD(maxFeePercentage, lusdWithdrawAmount, s.sl.lowerHint[msg.sender], s.sl.upperHint[msg.sender]);
		}
		return IERC20(lusdToken).balanceOf(address(this)).sub(snapshot); // This is amount received post 200LUSD deposit/fee
	}


	// This function will allow users to allocate their lusd and beans into any Beanstalk function
	function directFunds(uint256 beanAmount, bytes4 functionSelector, bytes[] calldata functionArgs) internal {
		(bool success, bytes memory data) = address(this).delegatecall(abi.encodeWithSelector(functionSelector, functionArgs));
		require(success, "LibLiquity: function call failed");
	}

	// This allows users to close/remove some eth some their trove by sending in LUSD
	function repayDebt(uint256 lusdAmount) internal {
		AppStorage storage s = LibAppStorage.diamondStorage();
		if (lusdAmount >= s.sl.lusdBalance[msg.sender]) {
			IBorrowerOperations(borrowerOperations).closeTrove();
			s.sl.lusdBalance[msg.sender] = 0;
		}
		else {
			IBorrowerOperations(borrowerOperations).repayLUSD(lusdAmount, s.sl.lowerHint[msg.sender], s.sl.upperHint[msg.sender]);
			s.sl.lusdBalance[msg.sender] = s.sl.lusdBalance[msg.sender].sub(lusdAmount);
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
       	uint arrayLength = ITroveManager(troveManager).getTroveOwnersCount();

        if (arrayLength == 0) {
        	return (address(0), 0, _inputRandomSeed);
        }

        hintAddress = ISortedTroves(sortedTroves).getLast();
        diff = _getAbsoluteDifference(_CR, ITroveManager(troveManager).getNominalICR(hintAddress));
        latestRandomSeed = _inputRandomSeed;

        uint i = 1;

        while (i < _numTrials) {
            latestRandomSeed = uint(keccak256(abi.encodePacked(latestRandomSeed)));

            uint arrayIndex = latestRandomSeed % arrayLength;
            address currentAddress = ITroveManager(troveManager).getTroveFromTroveOwnersArray(arrayIndex);
            uint currentNICR = ITroveManager(troveManager).getNominalICR(currentAddress);

            // check if abs(current - CR) > abs(closest - CR), and update closest if current is closer
            uint currentDiff = _getAbsoluteDifference(currentNICR, _CR);

            if (currentDiff < diff) {
                diff = currentDiff;
                hintAddress = currentAddress;
            }
            i++;
        }
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
