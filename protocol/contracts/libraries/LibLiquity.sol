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
	 * Hint Helper
	*/

       function getApproxHint(uint _CR, uint _numTrials, uint _inputRandomSeed)
        internal
        view
        returns (address hintAddress, uint diff, uint latestRandomSeed)
    {
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
        function findHints(uint256 lusdAmount, uint256 numTrials, uint256 randSeed) internal returns (address, address) {
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
