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

    function evaluatePolynomial(uint256[4] memory significands, uint8[4] memory exponents, bool[4] memory signs, uint256 x) public view returns (uint256) {
        return LibPolynomial.evaluatePolynomial(significands, exponents, signs, x);
    }

    function evaluatePolynomialIntegration(uint256[4] memory significands, uint8[4] memory exponents, bool[4] memory signs, uint256 start, uint256 end) public pure returns (uint256) {
        return LibPolynomial.evaluatePolynomialIntegration(significands, exponents, signs, start, end);
    }

    function findPiecewiseIndex(bytes calldata breakpoints, uint256 value, uint256 high) public view returns (uint256) {
        return LibPolynomial.findPiecewiseIndex(breakpoints, value, high);
    }
}
