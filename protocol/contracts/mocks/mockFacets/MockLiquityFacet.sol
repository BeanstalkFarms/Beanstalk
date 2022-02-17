/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/LiquityFacet/LiquityFacet.sol";

import 'hardhat/console.sol';

/**
 * @author Beasley
 * @title Mock Liquity Facet
**/

contract MockLiquityFacet is LiquityFacet {

	function internalBalance(address account, address token) public view returns (uint256) {
		return LibUserBalance._getInternalBalance(account, IERC20(token));
	}

	function associatedTrove(address account) public view returns (address) {
		return s.sl.trove[account];
	}

}
