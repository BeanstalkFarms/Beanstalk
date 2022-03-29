/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/LiquityFacet/LiquityFacet.sol";

/**
 * @author Beasley
 * @title Mock Liquity Facet
**/

contract MockLiquityFacet is LiquityFacet {

	function associatedTrove(address account) public view returns (address) {
		return s.trove[account];
	}

	function collateralizeWithApproxHintE(uint256 minFee, uint256 lusdAmount, uint256 numTrials, uint256 randSeed) public payable {
		_collateralizeWithApproxHint(minFee, lusdAmount, numTrials, randSeed);
   	}

   	function repayDebtE(uint256 lusdAmount, uint256 numTrials, uint256 randSeed) public {
		_repayDebt(lusdAmount, numTrials, randSeed);
   	}
}
