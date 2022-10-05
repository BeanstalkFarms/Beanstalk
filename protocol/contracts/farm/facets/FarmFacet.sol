/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibEth} from "../../libraries/Token/LibEth.sol";
import {LibFunction} from "../../libraries/LibFunction.sol";

/**
 * @title Farmfacet - Users call any function in Beanstalk
 **/


// Advanced Data is a function call that allows for return values from existing functions 
struct AdvancedData {
    bytes callData;
    bytes farmData;
}

contract FarmFacet {
    AppStorage internal s;

    /*
     * Farm Function
     */


    /// @notice Call multiple functions in Beanstalk and return the data from all of them if they all succeed
    /// @param data The encoded function data for each of the calls to make to this contract.
    /// @return results The results from each of the calls passed in via data
    function farm(bytes[] calldata data)
        external
        payable
        withEth
        returns (bytes[] memory results)
    {
        results = new bytes[](data.length);
        for (uint256 i; i < data.length; ++i) {
            results[i] = _farm(data[i]);
        }
    }

    /// @notice Call multiple functions in Beanstalk using 
    /// @param data The encoded function data for each of the calls to make to this contract.
    /// @return results The results from each of the calls passed in via data
    function advancedFarm(AdvancedData[] calldata data)
        external
        payable
        withEth
        returns (bytes[] memory results)
    {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; ++i) {
            results[i] = _advancedFarm(data[i], results);
        }
    }

    function _advancedFarm(AdvancedData calldata d, bytes[] memory returnData)
        internal
        returns (bytes memory result)
    {
        bytes1 pipeType = d.farmData[0];
        // 0x00 -> Normal pipe: Standard function call
        // 0x01 -> Inject 1 previous return value into function call calldata
        // 0x02 -> Inject n previous return values into function call calldata
        if (pipeType == 0x00) {
            result = _farm(d.callData);
        } else {
            result = LibFunction.buildAdvancedCalldata(d.callData, d.farmData, returnData);
            _farmMem(result);
        }
    }

    // delegatecall a Beanstalk function using calldata data.
    function _farm(bytes calldata data) private returns (bytes memory result) {
        bytes4 selector;
        bool success;
        assembly {
            selector := calldataload(data.offset)
        }
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }

    // delegatecall a Beanstalk function using memory data.
    function _farmMem(bytes memory data) private returns (bytes memory result) {
        bytes4 selector;
        bool success;
        assembly {
            selector := mload(add(data, 32))
        }
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }

    // With Eth signals to Beanstalk functions that 
    // they should not refund Eth at the end of the function 
    // because the function is wrapped in a Farm function.
    modifier withEth() {
        if (msg.value > 0) s.isFarm = 2;
        _;
        if (msg.value > 0) {
            s.isFarm = 1;
            LibEth.refundEth();
        }
    }
}
