/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../interfaces/IPipeline.sol";
import {LibFunction} from "../../libraries/LibFunction.sol";

contract PipelineFacet is IPipeline {
    address private constant PIPELINE = address(0);

    function pipe(Pipe calldata p)
        external
        payable
        override
        returns (bytes memory result) {
            IPipeline(PIPELINE).pipe(p);
        }

    function multiPipe(Pipe[] calldata pipes)
        external
        payable
        override
        returns (bytes[] memory results) {
            IPipeline(PIPELINE).multiPipe(pipes);
        }

    function dynamicPipe(Pipe calldata p, DynamicPipe calldata dynamicPipe)
        external
        payable
        override
        returns (bytes[] memory results) {
            IPipeline(PIPELINE).dynamicPipe(p, dynamicPipe);
        }

    function dynamicMultiPipe(Pipe calldata p, DynamicPipe[] calldata dynamicPipes)
        external
        payable
        override
        returns (bytes[] memory results) {
            IPipeline(PIPELINE).dynamicMultiPipe(p, dynamicPipes);
        }

    function payablePipe(PayablePipe calldata payablePipe)
        external
        payable
        override
        returns (bytes memory result) {
            IPipeline(PIPELINE).payablePipe(payablePipe);
        }

    function dynamicPayablePipe(PayablePipe calldata payablePipe, DynamicPayablePipe calldata dynamicPayablePipe)
        external
        payable
        override
        returns (bytes[] memory results) {
            IPipeline(PIPELINE).dynamicPayablePipe(payablePipe, dynamicPayablePipe);
        }

    function readPipe(Pipe calldata p) external view returns (bytes memory result) {
        bool success;
        (success, result) = p.target.staticcall(p.data);
        LibFunction.checkReturn(success, result);
    }
}
