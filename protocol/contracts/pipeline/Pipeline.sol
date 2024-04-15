//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IPipeline.sol";
import "../libraries/LibFunction.sol";
import "../libraries/LibClipboard.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";

import "forge-std/console.sol";

/**
 * @title Pipeline
 * @author Publius
 * @notice Pipeline creates a sandbox to execute any series of function calls on any series of protocols through Pipe functions.
 * Any assets left in Pipeline between transactions can be transferred out by any account.
 * Users Pipe a series of PipeCalls that each execute a function call to another protocol through Pipeline.
 * https://evmpipeline.org
 **/

contract Pipeline is IPipeline, ERC1155Holder, ERC721Holder {

    /**
     * @dev So Pipeline can receive Ether.
     */
    receive() external payable {}

    /**
     * @dev Returns the current version of Pipeline.
     */
    function version() external pure returns (string memory) {
        return "1.0.1";
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

        console.log('pipeline.sol print args');
        
        // Print each argument
        for (uint i = 0; i < args.length; i++) {
            console.log('extractData printing arg: ');
            console.logBytes(args[i]);
        }
    }

    /**
     * @notice Execute a single PipeCall.
     * Supports sending Ether through msg.value
     * @param p PipeCall to execute
     * @return result return value of PipeCall
    **/
    function pipe(PipeCall calldata p)
        external
        payable
        override
        returns (bytes memory result)
    {
        // console.log('pipe in Pipeline.sol');
        // console.log('pipe target: ', p.target);
        // console.log('pipe data:');
        // console.logBytes(p.data);
        // extractData(p.data);
        
        result = _pipe(p.target, p.data, msg.value);
    }
    
    /**
     * @notice Execute a list of executes a list of PipeCalls.
     * @param pipes list of PipeCalls to execute
     * @return results list of return values for each PipeCall
    **/
    function multiPipe(PipeCall[] calldata pipes)
        external
        payable
        override
        returns (bytes[] memory results)
    {
        results = new bytes[](pipes.length);
        for (uint256 i = 0; i < pipes.length; i++) {
            results[i] = _pipe(pipes[i].target, pipes[i].data, 0);
        }
    }

    /**
     * @notice Execute a list of AdvancedPipeCalls.
     * @param pipes list of AdvancedPipeCalls to execute
     * @return results list of return values for each AdvancedPipeCalls
    **/
    function advancedPipe(AdvancedPipeCall[] calldata pipes)
        external
        payable
        override
        returns (bytes[] memory results) {
            results = new bytes[](pipes.length);
            for (uint256 i = 0; i < pipes.length; ++i) {
                results[i] = _advancedPipe(pipes[i], results);
                console.log('advancedPipe results[i] i value: ', i);
                console.log('advancedPipe results[i]: ');
                console.logBytes(results[i]);
            }
        }

    // Execute function call using calldata
    function _pipe(
        address target,
        bytes calldata data,
        uint256 value
    ) private returns (bytes memory result) {
        bool success;

        console.log('_pipe data:');
        console.logBytes(data);
        (success, result) = target.call{value: value}(data);
        console.log('_pipe result:');
        console.logBytes(result);

        LibFunction.checkReturn(success, result);
    }

    // Execute function call using memory
    function _pipeMem(
        address target,
        bytes memory data,
        uint256 value
    ) private returns (bytes memory result) {
        bool success;
        // console.log('doing _pipeMem');   
        // console.log('_pipeMem target: ', target);
        // console.log('_pipeMem data:');
        console.logBytes(data);
        (success, result) = target.call{value: value}(data);
        // console.log('_pipeMem result:');
        // console.logBytes(result);

        LibFunction.checkReturn(success, result);
    }

    // Execute an AdvancedPipeCall
    function _advancedPipe(
        AdvancedPipeCall calldata p,
        bytes[] memory returnData
    ) private returns (bytes memory result) {
        uint256 value = getEthValue(p.clipboard);
        // 0x00 -> Normal pipe: Standard function call
        // else > Advanced pipe: Copy return data into function call through buildAdvancedCalldata
        if (p.clipboard[0] == 0x00) {
            result = _pipe(p.target, p.callData, value);
        } else {
            // console.log('_advancedPipe returnData latest object:');
            // console.logBytes(returnData[returnData.length - 1]);

            for (uint256 i = 0; i < returnData.length; i++) {
                console.log('_advancedPipe returnData[i]: ', i);
                console.logBytes(returnData[i]);
            }


            console.log('_advancedPipe result before: ');
            console.logBytes(result);
            result = LibClipboard.useClipboard(p.callData, p.clipboard, returnData);
            console.log('_advancedPipe result after: ');
            console.logBytes(result);
            result = _pipeMem(p.target, result, value);
            console.log('_advancedPipe result final: ');
            console.logBytes(result);
        }

        console.log('_advancedPipe result:');
        console.logBytes(result);
    }

    // Extracts Ether value from a Clipboard
    // clipboard[1] indicates whether there is an Ether value in the advanced data
    // if 0x00 -> No Ether value, return 0
    // else -> return the last 32 bytes of clipboard
    function getEthValue(bytes calldata clipboard) private pure returns (uint256 value) {
        if (clipboard[1] == 0x00) return 0;
        assembly { value := calldataload(sub(add(clipboard.offset, clipboard.length), 32))}
    }
}