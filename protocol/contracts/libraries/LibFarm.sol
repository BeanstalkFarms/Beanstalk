/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "./LibDiamond.sol";

library LibFarm {
    function farmDelegateCall(bytes4 functionSelector, bytes memory data) internal {
        address facet = getFacetForSelector(functionSelector);
        (bool success, bytes memory returndata) = address(facet).delegatecall(data);
        if (!success) {
            if (returndata.length == 0) revert();
            assembly {
                revert(add(32, returndata), mload(returndata))
            }
        }
    }

    function getFacetForSelector(bytes4 functionSelector) internal view returns (address facet) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        facet = ds
            .selectorToFacetAndPosition[functionSelector]
            .facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
    }
}
