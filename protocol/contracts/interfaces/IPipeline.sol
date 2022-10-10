//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/*
 * Pipeline is a public good protocol that allows smart contract protocols
 * to call other contracts in a permissionless and trustless fashion.
 * 
 * Smart contracts can pipe function calls to Pipeline.
 * Pipeline then executes the generic function calls in a close environment.
 * 
 * Pipes are generic function call payloads. There are two types of Pipes:
 * 1. Basic Pipes
 * 2. Advanced Pipes
 */

// Pipe: A basic Pipe used to perform a given function call to a target address.
struct Pipe {
    address target; // The contract address to call
    bytes data; // The callData including the function selector
}

// AdvancedPipe: A Pipe capable of perform advanced function calls including:
// 1. using a non-zero Ether value
// 2. copying return value data into subsequent function calls.
// advancedData should be in the following format.
// [ Pipe Type | Send Ether Flag | Pipe Type data | Ether Value (only if flag == 1)]
// [ 1 byte    | 1 byte          | n bytes        | 0 or 32 bytes                  ]
// See LibFunction.buildAdvancedCalldata for more details.
struct AdvancedPipe {
    address target; // The contract address to call
    bytes callData; // The callData including the function selector
    bytes advancedData; // The advanced pipe data.
}

interface IPipeline {

    function pipe(Pipe calldata p)
        external
        payable
        returns (bytes memory result);

    function multiPipe(Pipe[] calldata pipes)
        external
        payable
        returns (bytes[] memory results);

    function advancedPipe(AdvancedPipe[] calldata pipes)
        external
        payable
        returns (bytes[] memory results);

}
