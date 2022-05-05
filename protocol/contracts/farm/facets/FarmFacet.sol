/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import {LibDiamond} from "../../libraries/Diamond/LibDiamond.sol";

/**
 * @author Beasley
 * @title Users call any function in Beanstalk
 **/

contract FarmFacet {

    AppStorage internal s;

    /*
     * Farm Function
     */

    function _farm(bytes calldata data) private {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
        bytes4 functionSelector;
        assembly {
            functionSelector := calldataload(data.offset)
        }
        address facet = ds.selectorToFacetAndPosition[functionSelector].facetAddress;
        require(facet != address(0), "Diamond: Function does not exist");
        (bool success, ) = address(facet).delegatecall(data);
        require(success, "FarmFacet: Function call failed!");
    }

    function farm(bytes[] calldata data) external payable {
        for (uint256 i = 0; i < data.length; i++) {
            _farm(data[i]);
        }
        if (msg.value > 0 && address(this).balance > 0) {
            (bool success, ) = msg.sender.call{value: address(this).balance}(new bytes(0));
            require(success, 'Farm: Eth transfer Failed.');
        }
    }
}
