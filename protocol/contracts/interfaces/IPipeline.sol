//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @title IPipeline
 * @author Publius
 * @notice Pipeline Interface – Pipeline creates a sandbox to execute any series of function calls on any series of protocols through \term{Pipe} functions. 
 * Any assets left in Pipeline between transactions can be transferred out by any account. 
 * Users Pipe a series of PipeCalls that each execute a function call to another protocol through Pipeline. 
 **/

// PipeCalls specify a function call to be executed by Pipeline. 
// Pipeline supports 2 types of PipeCalls: PipeCall and AdvancedPipeCall.

// PipeCall makes a function call with a static target address and callData.
struct PipeCall {
    address target;
    bytes data;
}

// AdvancedPipeCall makes a function call with a static target address and both static and dynamic callData.
// AdvancedPipeCalls support sending Ether in calls.
// [ PipeCall Type | Send Ether Flag | PipeCall Type data | Ether Value (only if flag == 1)]
// [ 1 byte        | 1 byte          | n bytes        | 0 or 32 bytes                      ]
// See LibFunction.useClipboard for more details.
struct AdvancedPipeCall {
    address target;
    bytes callData;
    bytes clipboard;
}

interface IPipeline {

    function pipe(PipeCall calldata p)
        external
        payable
        returns (bytes memory result);

    function multiPipe(PipeCall[] calldata pipes)
        external
        payable
        returns (bytes[] memory results);

    function advancedPipe(AdvancedPipeCall[] calldata pipes)
        external
        payable
        returns (bytes[] memory results);

}
