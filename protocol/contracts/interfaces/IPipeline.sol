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

// DynamicPipe: A Pipe capable of injecting calldata dynamically into the function call
// calldata should be split into preData and postData at the location that calldata injection is desired
struct DynamicPipe {
    address target; // The contract address to call
    bytes preData; // The calldata to prepend the injected calldata
    bytes postData; // the calldata to append to the end of the injected calldata
}

// PayablePipe: A basic Pipe that supports sending Ether.
struct PayablePipe {
    address target; // The contract address to call
    bytes data; // The callData including the function selector
    uint256 value; // The Ether value to include in the tranasaction
}

// DynamicPayablePipe: A payable version of DynamicPipe
struct DynamicPayablePipe {
    address target; // The contract address to call
    bytes preData; // The calldata to prepend the injected calldata
    bytes postData; // the calldata to append to the end of the injected calldata
    uint256 value; // The Ether value to include in the tranasaction
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

    function dynamicPipe(Pipe calldata p, DynamicPipe calldata dynamicPipe)
        external
        payable
        returns (bytes[] memory results);

    function dynamicMultiPipe(Pipe calldata p, DynamicPipe[] calldata dynamicPipes)
        external
        payable
        returns (bytes[] memory results);

    function payablePipe(PayablePipe calldata payablePipe)
        external
        payable
        returns (bytes memory result);

    function dynamicPayablePipe(PayablePipe calldata payablePipe, DynamicPayablePipe calldata dynamicPayablePipe)
        external
        payable
        returns (bytes[] memory results);
}
