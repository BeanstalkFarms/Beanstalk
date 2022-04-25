/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/MarketplaceFacet/MarketplaceFacet.sol";

/**
 * @author Publius
 * @title Mock Marketplace Facet
**/
contract MockMarketplaceFacet is MarketplaceFacet {
    function deleteOrders(bytes32[] calldata ids) external {
        for (uint i = 0; i < ids.length; i++) {
            delete s.podOrders[ids[i]];
        }
    }
}
