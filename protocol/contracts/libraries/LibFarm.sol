/*
 SPDX-License-Identifier: MIT
*/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibFunction} from "./LibFunction.sol";
import {LibClipboard} from "./LibClipboard.sol";
import "hardhat/console.sol";

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
        bytes1 pipeType = data.clipboard[0];
        // 0x00 -> Static Call - Execute static call
        // else > Advanced Call - Use clipboard on and execute call
        if (pipeType == 0x00) {
            // console.log('data.callData: ');
            // console.logBytes(data.callData);
            result = _farmMem(data.callData);
        } else {
            // console.log('data.callData: ');
            // console.logBytes(data.callData);
            
            bytes memory callData = LibClipboard.useClipboard(
                data.callData,
                data.clipboard,
                returnData
            );
            // console.log('LibFarm _advancedFarmMem callData after clipboard: ');
            // console.logBytes(callData);
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

    function extractData(bytes memory data) public view returns (bytes4 selector, bytes[] memory args) {
        // Extract the selector

        
        // assembly {
        //     selector := mload(add(data, 32))
        // }


        // selector = bytes4(uint32(uint256(data[0])));

        // console.log('init array');
        
        // Initialize an array to hold the arguments
        args = new bytes[]((data.length - 4) / 32);

        // console.log('extract args');
        
        // Extract each argument
        for (uint i = 4; i < data.length; i += 32) {
            // console.log('here');
            bytes memory arg = new bytes(32);
            for (uint j = 0; j < 32; j++) {
                // console.log('here 2');
                // Check if we're within the bounds of the data array
                if (i + j < data.length) {
                    // console.log('good length');
                    arg[j] = data[i + j];
                } else {
                    console.log('bad length');
                    // If we're out of bounds, fill the rest of the argument with zeros
                    arg[j] = byte(0);
                    console.log('hm we went out of bounds uh oh');
                }
            }
            // console.log('here 3');
            
            uint index = (i - 4) / 32;
            // Check if the index is within bounds
            if (index < args.length) {
                args[index] = arg;
            } else {
                console.log('index was out of bounds');
                console.log('index: ', index);
                console.log('args.length: ', args.length);
                // Handle the case where the index is out of bounds
                // This should not happen if the calculation is correct, but it's good to have a safeguard
                // revert("Index out of bounds");
            }
        }
        
        // Print the selector
        // console.log('extractData printing selector');
        // console.logBytes4(selector);

        console.log('print cargs');
        
        // Print each argument
        for (uint i = 0; i < args.length; i++) {
            console.log('extractData printing arg: ');
            console.logBytes(args[i]);
        }
    }

    // delegatecall a Beanstalk function using memory data
    function _farmMem(bytes memory data) internal returns (bytes memory result) {
        bytes4 selector;
        bool success;
        assembly {
            selector := mload(add(data, 32))
        }
        // console.log('_farmMem selector: ');
        console.logBytes4(selector);
        address facet = LibFunction.facetForSelector(selector);
        // console.log('_farmMem facet: ', facet);
        // console.log('_farmMem data: ');
        console.logBytes(data);

        (success, result) = facet.delegatecall(data);
        
        LibFunction.checkReturn(success, result);
    }
}
