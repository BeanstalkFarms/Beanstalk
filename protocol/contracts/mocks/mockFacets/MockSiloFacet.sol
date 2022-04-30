/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "../../farm/facets/SiloFacet/SiloFacet.sol";

/**
 * @author Publius
 * @title Mock Silo Facet
**/

interface WhitelistSilo {
    function whitelistToken(address token, bytes4 selector, uint32 stalk, uint32 seeds) external;
}

contract MockSiloFacet is SiloFacet {

    using SafeMath for uint256;

    function mockWhitelistToken(address token, bytes4 selector, uint32 stalk, uint32 seeds) external {
        WhitelistSilo(address(this)).whitelistToken(token, selector, stalk, seeds);
    }

    function mockBDV(uint256 amount) external pure returns (uint256) {
        return amount;
    }
}