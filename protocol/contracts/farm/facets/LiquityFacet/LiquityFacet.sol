/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../../../libraries/LibLiquity.sol';
import '../../AppStorage.sol';
import './TroveFactory.sol';
import '../../../interfaces/ILiquityManager.sol';
import '../../../libraries/LibUserBalance.sol';
import '../../../libraries/LibCurve.sol';

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/math/SafeMath.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

/**
 * @author Beasley
 * @title Users lend on Liquity for BEAN
**/
contract LiquityFacet is TroveFactory {

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
   * Public Functions
  */

  function manageTroveWithApproxHint(uint256 maxFeePercentage, uint256 lusdAmount, uint256 numTrials, uint256 randSeed) public payable {
	  _manageTroveWithApproxHint(maxFeePercentage, lusdAmount, numTrials, randSeed);
	}

  function repayDebt(uint256 lusdAmount, uint256 numTrials, uint256 randSeed, bool fromInternalBalance) public payable {
    require(LibUserBalance.getCombinedInternalExternalBalance(msg.sender, IERC20(lusdToken)) >= lusdAmount, "LiquityFacet: Not enough LUSD");
    if (fromInternalBalance) {
      uint256 covered = LibUserBalance._decreaseInternalBalance(msg.sender, IERC20(lusdToken), lusdAmount, true);
      if (covered != lusdAmount) IERC20(lusdToken).transferFrom(msg.sender, address(this), lusdAmount.sub(covered));
    }
    else IERC20(lusdToken).transferFrom(msg.sender, address(this), lusdAmount);
    _repayDebt(lusdAmount, numTrials, randSeed);
  }

	/*
	 * Trove Functions
	*/

	function _manageTroveWithApproxHint(uint256 minFee, uint256 lusdAmount, uint256 numTrials, uint256 randSeed) private {
	  if (s.trove[msg.sender] == address(0)) s.trove[msg.sender] = createTroveContract(msg.sender);
	  uint256 lusdBack = ILiquityManager(s.trove[msg.sender]).manageTroveWithApproxHint{value: msg.value}(minFee, lusdAmount, numTrials, randSeed);
	  LibUserBalance._increaseInternalBalance(msg.sender, IERC20(lusdToken), lusdBack);
   	}

  function _repayDebt(uint256 lusdAmount, uint256 numTrials, uint256 randSeed) private {
	  require(s.trove[msg.sender] != address(0), "LiquityFacet: User has no trove");
	  SafeERC20.safeTransfer(IERC20(lusdToken), s.trove[msg.sender], lusdAmount);
	  uint256 excessLUSD = ILiquityManager(s.trove[msg.sender]).repayDebt(lusdAmount, numTrials, randSeed);
    if (excessLUSD > 0) LibUserBalance._increaseInternalBalance(msg.sender, IERC20(lusdToken), excessLUSD);
   	}

	function liquityManager() public returns (ILiquityManager) {
		return ILiquityManager(s.trove[msg.sender]);
	}
}

