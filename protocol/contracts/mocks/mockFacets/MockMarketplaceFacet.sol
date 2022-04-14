/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.7.6;
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

    function getPriceAtIndex(PiecewiseCubic calldata f, uint256 x, uint256 i) external view returns (uint256) {
        return _getPriceAtIndex(f, x, i);
    }

    function getSumOverRange(PiecewiseCubic calldata f, uint256 x, uint256 amount) external view returns (uint256) {
        return _getSumOverPiecewiseRange(f, x, amount);
    }

    function findIndexWithinSubinterval(uint256[10] calldata ranges, uint256 x, uint256 low, uint256 high) external pure returns (uint256) {
        return LibMathFP.findIndexWithinSubinterval(ranges, x, low, high);
    }
}
