/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import "./LibFunction.sol";

/**
 * @title Lib Farm
 **/
library LibFarm {
    // AdvancedFarmCall is a Farm call that can use a Clipboard.
    // See LibFunction.useClipboard for details
    struct AdvancedFarmCall {
        bytes callData;
        bytes clipboard;
    }

    function advancedFarm(AdvancedFarmCall calldata d, bytes[] memory returnData)
        internal
        returns (bytes memory result)
    {
        bytes1 pipeType = d.clipboard[0];
        // 0x00 -> Normal pipe: Standard function call
        // else > Advanced pipe: Copy return data into function call through useClipboard
        if (pipeType == 0x00) {
            result = farm(d.callData);
        } else {
            result = LibFunction.useClipboard(
                d.callData,
                d.clipboard,
                returnData
            );
            farmMem(result);
        }
    }

    function advancedFarmMem(AdvancedFarmCall memory d, bytes[] memory returnData)
        internal
        returns (bytes memory result)
    {
        bytes1 pipeType = d.clipboard[0];
        // 0x00 -> Normal pipe: Standard function call
        // else > Advanced pipe: Copy return data into function call through useClipboardMem
        if (pipeType == 0x00) {
            result = farmMem(d.callData);
        } else {
            result = LibFunction.useClipboardMem(
                d.callData,
                d.clipboard,
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
    function farmMem(bytes memory data) internal returns (bytes memory result) {
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
