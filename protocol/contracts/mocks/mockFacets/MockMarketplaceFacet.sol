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

    function _evaluatePPoly(
        PPoly32 calldata f,
        uint256 x,
        uint256 pieceIndex,
        uint256 evaluationDegree
    ) public view returns (uint256) {
        return evaluatePPoly(f, x, pieceIndex, evaluationDegree);
    }
    function _getDynamicListingPrice(PodListing calldata l) external view returns (uint256) {
        return getDynamicListingPrice(l);
    }

    function _getDynamicOrderAmount(PPoly32 calldata f, uint256 index, uint256 start, uint256 amount) external view returns (uint256) {
        return getDynamicOrderAmount(f, index + start, amount);
    }

    function findIndex(uint256[32] calldata array, uint256 value) external view returns(uint256) {
        uint256 maxIndex = getMaxPieceIndex(array);
        return findIndex(array, value, maxIndex);
    }


}
