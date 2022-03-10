/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import '../../farm/facets/FarmFacet/FarmFacet.sol';

/**
 * @author Beasley
 * @title Mock Farm facet for debugging
**/
contract MockFarmFacet is FarmFacet {

	function functionSelectorsE(address facet) public view returns (FacetFunctionSelectors memory f) {
		DiamondStorage storage ds = diamondStorage();
		f = ds.facetFunctionSelectors[facet];
	}

	function facetAddressE(bytes4 selector) public view returns (FacetAddressAndPosition memory f) {
		DiamondStorage storage ds = diamondStorage();
		f = ds.selectorToFacetAndPosition[selector];
	}
}
