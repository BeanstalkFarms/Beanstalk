/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../interfaces/IPipeline.sol";

contract PipelineFacet {
    address private constant PIPELINE = address(0);

    function pipe(IPipeline.Pipe calldata p)
        external
        payable
        returns (bytes memory result) {
            result = IPipeline(PIPELINE).pipe(p);
        }

    function pipeMulti(IPipeline.Pipe[] calldata pipes)
        external
        payable
        returns (bytes[] memory results) 
    {
        results = IPipeline(PIPELINE).pipeMulti(pipes);
    }

    function pipeEther(IPipeline.EtherPipe calldata etherPipe)
        external
        payable
        returns (bytes memory result)
    {
        result = IPipeline(PIPELINE).pipeEther{value: etherPipe.value}(etherPipe);
    }

    function pipeReturn(IPipeline.Pipe calldata p, IPipeline.ReturnPipe calldata returnPipe)
        external
        payable
        returns (bytes[] memory results)
    {
        results = IPipeline(PIPELINE).pipeReturn(p, returnPipe);
    }

    function pipeEtherReturn(IPipeline.EtherPipe calldata etherPipe, IPipeline.EtherReturnPipe calldata etherReturnPipe)
        external
        payable
        returns (bytes[] memory results)
    {
        results = IPipeline(PIPELINE).pipeEtherReturn{value: etherPipe.value}(etherPipe, etherReturnPipe);
    }
}
