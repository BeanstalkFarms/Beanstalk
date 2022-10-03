/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../interfaces/IPipeline.sol";
import "../../libraries/LibFunction.sol";
import "../../libraries/Token/LibEth.sol";

contract PipelineFacet {
    address private constant PIPELINE =
        0xc5a5C42992dECbae36851359345FE25997F5C42d;

    function pipe(Pipe calldata p)
        external
        payable
        returns (bytes memory result)
    {
        result = IPipeline(PIPELINE).pipe(p);
    }

    function multiPipe(Pipe[] calldata pipes)
        external
        payable
        returns (bytes[] memory results)
    {
        results = IPipeline(PIPELINE).multiPipe(pipes);
    }

    function advancedPipe(AdvancedPipe[] calldata pipes, uint256 value)
        external
        payable
        returns (bytes[] memory results)
    {
        results = IPipeline(PIPELINE).advancedPipe{value: value}(pipes);
        LibEth.refundEth();
    }

    function etherPipe(Pipe calldata p, uint256 value)
        external
        payable
        returns (bytes memory result)
    {
        result = IPipeline(PIPELINE).pipe{value: value}(p);
        LibEth.refundEth();
    }

    function readPipe(Pipe calldata p)
        external
        view
        returns (bytes memory result)
    {
        bool success;
        (success, result) = p.target.staticcall(p.data);
        LibFunction.checkReturn(success, result);
    }
}
