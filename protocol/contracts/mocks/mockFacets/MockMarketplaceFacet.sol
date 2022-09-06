/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/MarketplaceFacet/MarketplaceFacet.sol";
// import "../../libraries/LibPolynomial.sol";

/**
 * @author Publius
 * @title Mock Marketplace Facet
**/
contract MockMarketplaceFacet is MarketplaceFacet {

    function evaluatePolynomial(uint256[4] memory significands, uint256 packedExponents, uint256 packedSigns, uint256 piece, uint256 x) public pure returns (uint256) {
        uint8[4] memory exponents = LibPolynomial.getPackedExponents(packedExponents, piece);
        bool[4] memory signs = LibPolynomial.getPackedSigns(packedSigns, piece);
        return LibPolynomial.evaluatePolynomial(significands, exponents, signs, x);
    }

    function evaluatePolynomialIntegration(uint256[4] memory significands, uint256 packedExponents, uint256 packedSigns, uint256 piece, uint256 start, uint256 end) public pure returns (uint256) {
        uint8[4] memory exponents = LibPolynomial.getPackedExponents(packedExponents, piece);
        bool[4] memory signs = LibPolynomial.getPackedSigns(packedSigns, piece);
        return LibPolynomial.evaluatePolynomialIntegration(significands, exponents, signs, start, end);
    }

    function findIndexPiecewise4 (uint256[4] calldata breakpoints, uint256 value, uint256 high) public pure returns (uint256) {
        return LibPolynomial.findIndexPiecewise4(breakpoints, value, high);
    }

    function findIndexPiecewise16 (uint256[16] calldata breakpoints, uint256 value, uint256 high) public pure returns (uint256) {
        return LibPolynomial.findIndexPiecewise16(breakpoints, value, high);
    }

    function findIndexPiecewise64 (uint256[64] calldata breakpoints, uint256 value, uint256 high) public pure returns (uint256) {
        return LibPolynomial.findIndexPiecewise64(breakpoints, value, high);
    }
}
