/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "./LibDiamond.sol";

/**
 * @title Lib Function
 **/

library LibFunction {
    function checkReturn(bool success, bytes memory result) internal pure {
        if (!success) {
            // Next 5 lines from https://ethereum.stackexchange.com/a/83577
            if (result.length < 68) revert();
            assembly {
                result := add(result, 0x04)
            }
            revert(abi.decode(result, (string)));
        }
    }

    function facetForSelector(bytes4 selector) internal view returns (address facet) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facet = ds
            .selectorToFacetAndPosition[selector]
            .facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
    }
}
