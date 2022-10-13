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

    function getPrice(address tokenI, address tokenJ)
        external
        view
        returns (uint256 p)
    {
        p = LibOracle.getPrice(tokenI, tokenJ);
    }

    function price(address tokenI, address tokenJ)
        external
        returns (uint256 p)
    {
        p = LibOracle.price(tokenI, tokenJ);
    }

    function getOracle(address tokenI, address tokenJ)
        external
        view
        returns (LibOracle.Oracle memory os)
    {
        os = LibOracle.getOracle(tokenI, tokenJ);
    }

    function registerOracle(
        address tokenI,
        address tokenJ,
        address oracle,
        bytes4 selector,
        uint8 precision,
        bool flip,
        bool registerInverse
    ) external {
        LibDiamond.enforceIsOwnerOrContract();
        LibOracle.registerOracle(
            tokenI,
            tokenJ,
            oracle,
            selector,
            precision,
            flip,
            registerInverse
        );
    }
}
