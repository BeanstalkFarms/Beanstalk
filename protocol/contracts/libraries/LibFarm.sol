/*
 SPDX-License-Identifier: MIT
*/

pragma solidity ^0.8.20;

import {LibFunction} from "./LibFunction.sol";
import {LibClipboard} from "./LibClipboard.sol";

/**
 * @title Farm Lib
 * @author Beasley, Publius
 * @notice Perform multiple Beanstalk functions calls in a single transaction using Farm calls.
 * Any function stored in Beanstalk's EIP-2535 DiamondStorage can be called as a Farm call. (https://eips.ethereum.org/EIPS/eip-2535)
 **/

// AdvancedFarmCall is a Farm call that can use a Clipboard.
// See LibFunction.useClipboard for details
struct AdvancedFarmCall {
    bytes callData;
    bytes clipboard;
}

library LibFarm {
    function _advancedFarm(
        AdvancedFarmCall memory data,
        bytes[] memory returnData
    ) internal returns (bytes memory result) {
        bytes1 pipeType = data.clipboard.length == 0 ? bytes1(0) : data.clipboard[0];
        // 0x00 -> Static Call - Execute static call
        // else > Advanced Call - Use clipboard on and execute call.
        if (pipeType == 0x00) {
            result = _farm(data.callData);
        } else {
            bytes memory callData = LibClipboard.useClipboard(
                data.callData,
                data.clipboard,
                returnData
            );
            result = _farm(callData);
        }
    }

    // maybe remove this function?
    function _advancedFarmMem(
        AdvancedFarmCall memory data,
        bytes[] memory returnData
    ) internal returns (bytes memory result) {
        bytes1 pipeType = data.clipboard.length == 0 ? bytes1(0) : data.clipboard[0];
        // 0x00 -> Static Call - Execute static call
        // else > Advanced Call - Use clipboard on and execute call
        if (pipeType == 0x00) {
            result = _farm(data.callData);
        } else {
            bytes memory callData = LibClipboard.useClipboard(
                data.callData,
                data.clipboard,
                returnData
            );
            result = _farm(callData);
        }
    }

    // delegatecall a Beanstalk function using memory data
    function _farm(bytes memory data) internal returns (bytes memory result) {
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
