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

    function evaluatePolynomial(uint256[4] memory significands, uint256 packedExponents, uint256 packedSigns, uint256 piece, uint256 x) public pure returns (uint256) {
        uint8[4] memory exponents = getPackedExponents(packedExponents, piece);
        bool[4] memory signs = getPackedSigns(packedSigns, piece);
        return _evaluatePolynomial(significands, exponents, signs, x);
    }

    function evaluatePolynomialIntegration(uint256[4] memory significands, uint256 packedExponents, uint256 packedSigns, uint256 piece, uint256 start, uint256 end) public pure returns (uint256) {
        uint8[4] memory exponents = getPackedExponents(packedExponents, piece);
        bool[4] memory signs = getPackedSigns(packedSigns, piece);
        return _evaluatePolynomialIntegration(significands, exponents, signs, start, end);
    }

    function _getPackedExponents(uint256 packedExponents, uint256 piece) public pure returns (uint8[4] memory) {
        return getPackedExponents(packedExponents, piece);
    }

    function _getPackedSigns(uint256 packedSigns, uint256 piece) public pure returns (bool[4] memory) {
        return getPackedSigns(packedSigns, piece);
    }

    function _findPieceIndexFrom4(uint256[4] calldata breakpoints, uint256 value, uint256 high) public pure returns (uint256) {
        return findPieceIndexFrom4(breakpoints, value, high);
    }

    function _findPieceIndexFrom16(uint256[16] calldata breakpoints, uint256 value, uint256 high) public pure returns (uint256) {
        return findPieceIndexFrom16(breakpoints, value, high);
    }
}
