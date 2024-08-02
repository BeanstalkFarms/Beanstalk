//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IPipeline.sol";
import "../libraries/LibFunction.sol";
import "@openzeppelin/contracts/token/ERC1155/ERC1155Holder.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Holder.sol";

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
            }
        }

    // Execute function call using calldata
    function _pipe(
        address target,
        bytes calldata data,
        uint256 value
    ) private returns (bytes memory result) {
        bool success;
        (success, result) = target.call{value: value}(data);
        LibFunction.checkReturn(success, result);
    }

    // Execute function call using memory
    function _pipeMem(
        address target,
        bytes memory data,
        uint256 value
    ) private returns (bytes memory result) {
        bool success;
        (success, result) = target.call{value: value}(data);
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
            result = LibFunction.useClipboard(p.callData, p.clipboard, returnData);
            result = _pipeMem(p.target, result, value);
        }
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