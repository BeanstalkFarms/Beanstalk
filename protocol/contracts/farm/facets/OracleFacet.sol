// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../libraries/LibOracle.sol";
import "../../libraries/LibDiamond.sol";

/**
 * @author Publius
 * @title Oracle Facet
 **/
contract OracleFacet {
    function getPrice(address tokenI, address tokenJ) external view returns (uint256 price) {
        price = LibOracle.getPrice(tokenI, tokenJ);
    }

    function registerOracle(address tokenI, address tokenJ, LibOracle.Oracle calldata o) external {
        LibDiamond.enforceIsOwnerOrContract();
        LibOracle.registerOracle(tokenI, tokenJ, o);
    }
}
