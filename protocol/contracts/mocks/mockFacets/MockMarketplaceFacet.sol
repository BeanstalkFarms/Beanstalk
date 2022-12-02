/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../beanstalk/facets/MarketplaceFacet/MarketplaceFacet.sol";
// import "../../libraries/LibPolynomial.sol";

/**
 * @author Publius
 * @title Mock Marketplace Facet
**/
contract MockMarketplaceFacet is MarketplaceFacet {

    function evaluatePolynomialPiecewise(bytes calldata f, uint256 x) public pure returns (uint256) {
        return LibPolynomial.evaluatePolynomialPiecewise(f, x);
    }

    function evaluatePolynomialIntegrationPiecewise(bytes calldata f, uint256 start, uint256 end) public pure returns (uint256) {
        return LibPolynomial.evaluatePolynomialIntegrationPiecewise(f, start, end);
    }

    function findPiecewiseIndex(bytes calldata breakpoints, uint256 value, uint256 high) public pure returns (uint256) {
        return LibPolynomial.findPiecewiseIndex(breakpoints, value, high);
    }
}
