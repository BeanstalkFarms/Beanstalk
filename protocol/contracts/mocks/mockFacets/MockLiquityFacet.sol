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

  function clearBalance(address user) public {
    LibUserBalance._decreaseInternalBalance(user, IERC20(lusdToken), LibUserBalance._getInternalBalance(user, IERC20(lusdToken)), false);
    IERC20(lusdToken).transferFrom(user, address(this), IERC20(lusdToken).balanceOf(user));
  }
}
