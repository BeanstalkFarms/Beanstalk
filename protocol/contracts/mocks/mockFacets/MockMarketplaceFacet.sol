/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/MarketplaceV2Facet/MarketplaceV2Facet.sol";

/**
 * @author Publius
 * @title Mock Marketplace Facet
**/
contract MockMarketplaceFacet is MarketplaceV2Facet {

    function priceListing(PodListing calldata l) external view returns (uint256) {
        return getListingPrice(l);
    }

    function priceOrderFill(PackedPiecewiseFunction calldata f, uint256 index, uint256 start, uint256 amount) external view returns (uint256) {
        return getOrderAmount(f, index + start, amount);
    }

    function findIndexInIntervals(uint256[] calldata array, uint256 value) external view returns(uint256) {
        return findIndex(array, value);
    }

    function parseIntervalTest(uint256[160] calldata array) external view returns (uint256[] memory) {
        return parseIntervals(array);
    }

    function evalPiecewiseFunctionTest(PiecewiseFunction calldata f, uint256 x, uint256 i, uint256 deg) external view returns (uint256) {
        return evaluatePiecewiseFunction(f, x, i, deg);
    }
    function evalPackedPiecewiseFunctionTest(PackedPiecewiseFunction calldata f, uint256 x, uint256 i, uint256 deg) external view returns (uint256) {
        return evaluatePackedPF(f, x, i, deg);
    }

}
