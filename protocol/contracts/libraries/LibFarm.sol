/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "./LibDiamond.sol";

/**
 * @author Publius
 * @title Farm
 **/

library LibFarm {
        function farm(bytes calldata data) internal {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        bytes4 functionSelector;
        assembly {
            functionSelector := calldataload(data.offset)
        }
        address facet = ds
            .selectorToFacetAndPosition[functionSelector]
            .facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
        (bool success, bytes memory returndata) = address(facet).delegatecall(data);
        if (!success) {
            if (returndata.length == 0) revert();
            assembly {
                revert(add(32, returndata), mload(returndata))
            }
        }
    }
}