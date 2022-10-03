//SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/*
 * Pipeline is a public good protocol that allows smart contract protocols
 * to call each other in a permissionless and trustless fashion.
 * 
 * Smart contracts can pipe function calls to Pipeline.
 * 
 * Pipes are generic function call payloads
 */

// Pipe: A basic Pipe that does not support sending Ether.
struct Pipe {
    address target; // The contract address to call
    bytes data; // The callData including the function selector
}

// AdvancedPipe: A Pipe capable of perform advanced function calls including using a non-zero value, and injecting returning value data
// calldata should be split into preData and postData at the location that calldata injection is desired
struct AdvancedPipe {
    address target; // The contract address to call
    bytes callData; // The callData including the function selector
    bytes pipeData;
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
