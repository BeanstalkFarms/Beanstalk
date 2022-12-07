/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import "./LibFunction.sol";

/**
 * @title Lib Farm
 **/
library LibFarm {
    // Advanced Data is a function call that allows for return values from existing functions
    // See LibFunction.buildAdvancedCalldata for details
    struct AdvancedData {
        bytes callData;
        bytes advancedData;
    }

    function advancedFarm(AdvancedData calldata d, bytes[] memory returnData)
        internal
        returns (bytes memory result)
    {
        bytes1 pipeType = d.advancedData[0];
        // 0x00 -> Normal pipe: Standard function call
        // else > Advanced pipe: Copy return data into function call through buildAdvancedCalldata
        if (pipeType == 0x00) {
            result = farm(d.callData);
        } else {
            result = LibFunction.buildAdvancedCalldata(
                d.callData,
                d.advancedData,
                returnData
            );
            farmMem(result);
        }
    }

    function advancedFarmMem(AdvancedData memory d, bytes[] memory returnData)
        internal
        returns (bytes memory result)
    {
        bytes1 pipeType = d.advancedData[0];
        // 0x00 -> Normal pipe: Standard function call
        // else > Advanced pipe: Copy return data into function call through buildAdvancedCalldata
        if (pipeType == 0x00) {
            result = farmMem(d.callData);
        } else {
            result = LibFunction.buildAdvancedCalldata(
                d.callData,
                d.advancedData,
                returnData
            );
            farmMem(result);
        }
    }

    // delegatecall a Beanstalk function using calldata data
    function farm(bytes calldata data) internal returns (bytes memory result) {
        bytes4 selector;
        bool success;
        assembly {
            selector := calldataload(data.offset)
        }
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }

    // delegatecall a Beanstalk function using memory data
    function farmMem(bytes memory data)
        internal
        returns (bytes memory result)
    {
        bytes4 selector;
        bool success;
        assembly {
            selector := mload(add(data, 32))
        }
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }
}
