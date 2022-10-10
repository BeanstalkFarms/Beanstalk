//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IPipeline.sol";
import "../libraries/LibFunction.sol";

/**
 * @title Pipeline
 * @notice Executes generic function calls to other contracts
 **/

contract Pipeline is IPipeline {

    /**
     * @notice Perform 1 external function call
     * Supports sending Ether through msg.value
     * @param p A function call to execute stored in Pipe struct
     * @return result The pipe function call return data
    **/
    function pipe(Pipe calldata p)
        external
        payable
        override
        returns (bytes memory result)
    {
        result = _pipe(p.target, p.data, msg.value);
    }
    
    /**
     * @notice Perform a list of a external function calls
     * Does not support sending Ether
     * @param pipes A list of function calls to execute
     * @return results A list of pipe function call return data
    **/
    function multiPipe(Pipe[] calldata pipes)
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
     * @notice Perform a list of advanced function calls
     * Advanced function calls supprt sending Ether and return data injection
     * @param pipes a list of advanced pipe function calls
     * @return results a list of return values from the advanced function calls
    **/
    function advancedPipe(AdvancedPipe[] calldata pipes)
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

    // Execute advanced Pipeline function call
    function _advancedPipe(
        AdvancedPipe calldata p,
        bytes[] memory returnData
    ) private returns (bytes memory result) {
        uint256 value = getEthValue(p.advancedData);
        // 0x00 -> Normal pipe: Standard function call
        // else > Advanced pipe: Copy return data into function call through buildAdvancedCalldata
        if (p.advancedData[0] == 0x00) {
            result = _pipe(p.target, p.callData, value);
        } else {
            result = LibFunction.buildAdvancedCalldata(p.callData, p.advancedData, returnData);
            result = _pipeMem(p.target, result, value);
        }
    }

    // Extracts Ether value from Advanced Pipe data
    // The 2nd byte indicates whether there is an Ether value in the advanced data
    // 0x00 -> No Ether value
    // 0x01 -> Read last 32 bytes of advancedData to get Ether value
    function getEthValue(bytes calldata advancedData) private pure returns (uint256 value) {
        if (advancedData[1] == 0x00) return 0;
        assembly { value := calldataload(sub(add(advancedData.offset, advancedData.length), 32))}
    }
}