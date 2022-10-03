//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../interfaces/IPipeline.sol";
import "../libraries/LibFunction.sol";

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
        byte pipeType = p.pipeData[0];
        uint256 value = getEthValue(p.pipeData);
        if (pipeType == 0x00) {
            result = _pipe(p.target, p.callData, value);
        } else if (pipeType == 0x01) {
            (, bytes32 copyParams) = abi.decode(p.pipeData, (uint256, bytes32));
            bytes memory callData = LibFunction.pasteBytes(returnData, p.callData, copyParams);
            result = _pipeMem(p.target, callData, value);
        } else if (pipeType == 0x02) {
            (, bytes32[] memory copyParams) = abi.decode(p.pipeData, (uint256, bytes32[]));
            bytes memory callData = p.callData;
            for (uint i; i < copyParams.length; i++)
                callData = LibFunction.pasteBytes(returnData, callData, copyParams[i]);
            result = _pipeMem(p.target, callData, value);
        }
        else {
            revert("Pipeline: Type not supported");
        }
    }

    function getEthValue(bytes calldata pipeData) internal pure returns (uint256 value) {
        if (pipeData[1] == bytes8(0)) return 0;
        assembly { value := calldataload(sub(add(pipeData.offset, pipeData.length), 32))}
    }
}