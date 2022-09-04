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

    // function evaluatePolynomial(uint256[4] memory significands, uint256 packedExponents, uint256 packedSigns, uint256 piece, uint256 x) public view returns (uint256) {
    //     uint8[4] memory exponents = getPackedExponents(packedExponents, piece);
    //     bool[4] memory signs = getPackedSigns(packedSigns, piece);
    //     return _evaluatePolynomial(significands, exponents, signs, x);
    // }

    // function evaluatePolynomialIntegration(uint256[4] memory significands, uint256 packedExponents, uint256 packedSigns, uint256 piece, uint256 start, uint256 end) public view returns (uint256) {
    //     uint8[4] memory exponents = getPackedExponents(packedExponents, piece);
    //     bool[4] memory signs = getPackedSigns(packedSigns, piece);
    //     return _evaluatePolynomialIntegration(significands, exponents, signs, start, end);
    // }

}
