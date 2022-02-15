/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../../../libraries/LibLiquity.sol';
import './Designate.sol';

/**
 * @author Beasley
 * @title Users lend on Liquity for BEAN
**/
contract LiquityFacet is Designate {

    /*
     * Liquity Data
    */
	
    /*
     * Collateralize
    */ 

   function collateralize(uint256 maxFeeAmount, uint256 lusdWithdrawAmount, uint256 numTrials, uint256 randSeed) public payable {
	LibLiquity.collateralizeWithApproxHint(maxFeeAmount, lusdWithdrawAmount, numTrials, randSeed);
   }

   function repayDebt(uint256 lusdAmount, uint256 numTrials, uint256 randSeed) public {
	LibLiquity.repayDebt(lusdAmount, numTrials, randSeed);
   }
}
