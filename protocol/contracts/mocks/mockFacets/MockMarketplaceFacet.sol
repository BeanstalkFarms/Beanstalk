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


    function _getAmountBeansToFill4PiecesDynamicOrder(PiecewisePolynomial_4 calldata f, uint256 placeInLine, uint256 amountPodsFromOrder) public view returns (uint256){
        return getAmountBeansToFill4PiecesDynamicOrder(f, placeInLine, amountPodsFromOrder);
    }

    function _getAmountBeansToFill16PiecesDynamicOrder(PiecewisePolynomial_16 calldata f, uint256 placeInLine, uint256 amountPodsFromOrder) public view returns (uint256){
        return getAmountBeansToFill16PiecesDynamicOrder(f, placeInLine, amountPodsFromOrder);
    }

    function _getAmountBeansToFill64PiecesDynamicOrder(PiecewisePolynomial_64 calldata f, uint256 placeInLine, uint256 amountPodsFromOrder) public view returns (uint256){
        return getAmountBeansToFill64PiecesDynamicOrder(f, placeInLine, amountPodsFromOrder);
    }

    function evaluatePolynomial(uint256[4] memory significands, uint256 packedExponents, uint256 packedSigns, uint256 piece, uint256 x) public view returns (uint256) {
        uint8[4] memory exponents = getPackedExponents(packedExponents, piece);
        bool[4] memory signs = getPackedSigns(packedSigns, piece);
        return _evaluatePolynomial(significands, exponents, signs, x);
    }

    function evaluatePolynomialIntegration(uint256[4] memory significands, uint256 packedExponents, uint256 packedSigns, uint256 piece, uint256 start, uint256 end) public view returns (uint256) {
        uint8[4] memory exponents = getPackedExponents(packedExponents, piece);
        bool[4] memory signs = getPackedSigns(packedSigns, piece);
        return _evaluatePolynomialIntegration(significands, exponents, signs, start, end);
    }

    function _findPieceIndexFrom4(uint256[4] calldata breakpoints, uint256 value, uint256 high) public pure returns (uint256) {
        return findPieceIndexFrom4(breakpoints, value, high);
    }

    function _findPieceIndexFrom16(uint256[16] calldata breakpoints, uint256 value, uint256 high) public pure returns (uint256) {
        return findPieceIndexFrom16(breakpoints, value, high);
    }

    function _findPieceIndexFrom64(uint256[64] calldata breakpoints, uint256 value, uint256 high) public pure returns (uint256) {
        return findPieceIndexFrom64(breakpoints, value, high);
    }
}
