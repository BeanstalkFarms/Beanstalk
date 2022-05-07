/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../farm/facets/SproutFacet.sol";

/**
 * @author Publius
 * @title Mock Sprout Facet
**/

contract MockSproutFacet is SproutFacet {
    function setSproutE(bool sprouting, uint256 sprouts) external {
        s.season.sprouting = sprouting;
        s.totalSprouts = sprouts;
    }
}