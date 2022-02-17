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

/**
 * @author Beasley
 * @title Users lend on Liquity for BEAN
**/
contract LiquityFacet is LiquityFactory {

    using SafeMath for uint256;

    /*
     * Collateralize
    */ 

    AppStorage internal s;

    // Addresses are internal for MockFacets
    address internal constant borrowerOperations = address(0x24179CD81c9e782A4096035f7eC97fB8B783e007);
    address internal constant troveManager = address(0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2);
    address internal constant lusdToken = address(0x5f98805A4E8be255a32880FDeC7F6728C6568bA0);
    address internal constant sortedTroves = address(0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6);
    address internal constant activePool = address(0xDf9Eb223bAFBE5c5271415C75aeCD68C21fE3D7F);
    address internal constant priceFeed = address(0x4c517D4e2C851CA76d7eC94B805269Df0f2201De);

    /*
     * Contract Communication
    */

   function collateralizeWithApproxHint(uint256 minFee, uint256 lusdAmount, uint256 numTrials, uint256 randSeed) public payable {
	   if (s.sl.trove[msg.sender] == address(0)) s.sl.trove[msg.sender] = createTroveContract(msg.sender);
	   ILiquityManager(s.sl.trove[msg.sender]).collateralizeWithApproxHint{value: msg.value}(minFee, lusdAmount, numTrials, randSeed);
	   LibUserBalance._increaseInternalBalance(msg.sender, IERC20(lusdToken), lusdAmount);
   }

   function repayDebt(uint256 lusdAmount, uint256 numTrials, uint256 randSeed) public {
	   require(s.sl.trove[msg.sender] != address(0), "LiquityFacet: User has no trove");
	   SafeERC20.safeTransfer(IERC20(lusdToken), s.sl.trove[msg.sender], lusdAmount);
	   ILiquityManager(s.sl.trove[msg.sender]).repayDebt(lusdAmount, numTrials, randSeed);
   }

   /*
    * Generalized Functions
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
       		ILiquityManager(s.sl.trove[msg.sender]).collateralizeWithApproxHint(maxFeePercentage, lusdWithdrawAmount, numTrials, randSeed);
		AppStorage storage s = LibAppStorage.diamondStorage();
		address[] memory path = new address[](3);
		path[0] = lusdToken;
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

	function directFunds(uint256 beanAmount, bytes4 functionSelector, bytes[] calldata functionArgs) internal {
		(bool success,) = address(this).delegatecall(abi.encodeWithSelector(functionSelector, functionArgs));
		require(success, "LibLiquity: function call failed.");
	}

	function liquityManager() public returns (ILiquityManager) {
		return ILiquityManager(s.sl.trove[msg.sender]);
	}
}
