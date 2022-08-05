/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "./LibDiamond.sol";

/**
 * @author Publius
 * @title Internal Library handles gas efficient function calls between facets.
 **/

interface IBS {
    function update(address account) external payable;
}

library LibInternal {
    function updateSilo(address account) internal {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        address facet = ds
            .selectorToFacetAndPosition[IBS.update.selector]
            .facetAddress;
        bytes memory myFunctionCall = abi.encodeWithSelector(
            IBS.update.selector,
            account
        );
        (bool success, ) = address(facet).delegatecall(myFunctionCall);
        require(success, "Silo: update failed.");
    }
}
