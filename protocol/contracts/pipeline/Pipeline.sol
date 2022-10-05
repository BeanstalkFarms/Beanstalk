//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IPipeline.sol";
import "../libraries/LibFunction.sol";
import "hardhat/console.sol";

contract Pipeline is IPipeline {
    function pipe(Pipe calldata p)
        external
        payable
        override
        returns (bytes memory result)
    {
        result = _pipe(p.target, p.data, msg.value);
    }

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

    function _pipe(
        address target,
        bytes calldata data,
        uint256 value
    ) internal returns (bytes memory result) {
        bool success;
        (success, result) = target.call{value: value}(data);
        LibFunction.checkReturn(success, result);
    }

    function _pipeMem(
        address target,
        bytes memory data,
        uint256 value
    ) internal returns (bytes memory result) {
        bool success;
        (success, result) = target.call{value: value}(data);
        LibFunction.checkReturn(success, result);
    }

    function _advancedPipe(
        AdvancedPipe calldata p,
        bytes[] memory returnData
    ) internal returns (bytes memory result) {
        uint256 value = getEthValue(p.pipeData);
        // Check if normal Pipe call, if not use advanced call
        if (p.pipeData[0] == 0x00) {
            result = _pipe(p.target, p.callData, value);
        } else {
            result = LibFunction.buildAdvancedCalldata(p.callData, p.pipeData, returnData);
            result = _pipeMem(p.target, result, value);
        }
    }

    function getEthValue(bytes calldata pipeData) internal view returns (uint256 value) {
        if (pipeData[1] == bytes8(0)) return 0;
        console.log("EthValue");
        console.logBytes(pipeData);
        assembly { value := calldataload(sub(add(pipeData.offset, pipeData.length), 32))}
    }
}