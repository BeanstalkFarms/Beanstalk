/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibDiamond} from "./LibDiamond.sol";

interface IBS {
    function mow(address account, address token) external payable;
}

/**
 * @author Publius
 * @title Internal Library handles gas efficient function calls between facets.
 */
library LibInternal {
    function mow(address account, address token) internal {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        address facet = ds
            .selectorToFacetAndPosition[IBS.mow.selector]
            .facetAddress;
        bytes memory callData = abi.encodeWithSelector(
            IBS.mow.selector,
            account,
            token
        );
        (bool success, ) = address(facet).delegatecall(callData);
        require(success, "Silo: mow failed");
    }
}
