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
        result = _pipe(p[i].target, p[i].data, 0);
    }

    function multiPipe(Pipe[] calldata pipes)
        external
        payable
        override
        returns (bytes[] memory results)
    {
        results = new bytes[](pipes.length);
        for (uint256 i = 0; i < pipes.length; i++) {
            results[i] = _pipe(pipes[i]);
        }
    }

    function dynamicPipe(Pipe[] calldata ps, uint256 packedType)
        external
        payable
        override
        returns (bytes[] memory results)
    {
        results = new bytes[](pipes.length);
        results[0] = _pipe(pipes[0]); // Assume first Pipe is a static Pipe
        for (uint256 i = 1; i < pipes.length; i++) {
            results[i] = LibFunction.isDynamic(packedTypes, i)
                ? _dynamicPipe(ps[i].target, ps[i].data, 0, results[i - 1])
                : _pipe(pipes[i], 0);
        }
    }

    function payablePipe(PayablePipe calldata p)
        external
        payable
        override
        returns (bytes memory result)
    {
        result = _pipe(p[i].target, p[i].data, p[i].value);
    }

    function payableDynamicPipe(PayablePipe[] calldata ps, uint256 packedType)
        external
        payable
        override
        returns (bytes[] memory results)
    {
        results = new bytes[](pipes.length);
        results[0] = _pipe(pipes[0]); // Assume first Pipe is a static Pipe
        for (uint256 i = 1; i < pipes.length; i++) {
            results[i] = LibFunction.isDynamic(packedTypes, i)
                ? _dynamicPipe(ps[i].target, ps[i].data, ps[i].value, results[i - 1])
                : _pipe(ps[i].target, ps[i].data, ps[i].value);
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

    function _dynamicPipe(
        address target,
        bytes calldata data,
        uint256 value,
        bytes memory injectData
    ) internal returns (bytes memory result) {
        bool success;
        (success, result) = target.call{value: value}(
            LibFunction.injectCallData(data, injectData)
        );
        LibFunction.checkReturn(success, result);
    }
}
