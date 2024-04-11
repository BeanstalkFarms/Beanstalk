/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibFunction} from "./LibFunction.sol";
import {LibClipboard} from "./LibClipboard.sol";

import "forge-std/console.sol";
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
        AdvancedFarmCall calldata data,
        bytes[] memory returnData
    ) internal returns (bytes memory result) {
        bytes1 pipeType = data.clipboard[0];
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
            result = _farmMem(callData);
        }
    }

    // solidity kind of the worst for this
    function _advancedFarmMem(
        AdvancedFarmCall memory data,
        bytes[] memory returnData
    ) internal returns (bytes memory result) {
        
        // if no clipboard is attached, pipeType = 0.
        bytes1 pipeType = data.clipboard.length == 0 ? bytes1(0) : data.clipboard[0];
        
        // 0x00 -> Static Call - Execute static call
        // else > Advanced Call - Use clipboard on and execute call
        console.log("pipeType:", uint8(pipeType));
        if (pipeType == 0x00) {
            // console.log('data.callData: ');
            // console.logBytes(data.callData);
            result = _farmMem(data.callData);
        } else {
            console.log('data.callData: ');
            console.logBytes(data.callData);
            bytes memory callData = LibClipboard.useClipboard(
                data.callData,
                data.clipboard,
                returnData
            );
            console.log('LibFarm _advancedFarmMem callData after clipboard: ');
            console.logBytes(callData);
            result = _farmMem(callData);
        }
    }

    // delegatecall a Beanstalk function using calldata data
    function _farm(bytes calldata data) internal returns (bytes memory result) {
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
    function _farmMem(bytes memory data) internal returns (bytes memory result) {
        bytes4 selector;
        bool success;
        assembly {
            selector := mload(add(data, 32))
        }
        // console.log('_farmMem selector: ');
        // console.logBytes4(selector);
        address facet = LibFunction.facetForSelector(selector);
        // console.log('_farmMem facet: ', facet);
        // console.log('_farmMem data: ');
        // console.logBytes(data);

        (success, result) = facet.delegatecall(data);
        
        LibFunction.checkReturn(success, result);
    }
}
