/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import "../../interfaces/IPipeline.sol";
import "../../libraries/LibFunction.sol";
import "../../libraries/Token/LibEth.sol";

/**
 * @title Depot Facet
 * @notice Perform function calls to external function calls through Pipeline in a single transcation
 **/

contract DepotFacet {
    address private constant PIPELINE =
        0xc5a5C42992dECbae36851359345FE25997F5C42d;

    /**
     * @notice Perform 1 external function call through Pipeline
     * @param p A function call stored in Pipe struct
     * @return result The function call return data
    **/
    function pipe(Pipe calldata p)
        external
        payable
        returns (bytes memory result)
    {
        result = IPipeline(PIPELINE).pipe(p);
    }


    /**
     * @notice Perform a list of a external function calls through Pipeline
     * Does not support sending Ether in the call
     * @param pipes a list of function calls stored in Pipe struct 
     * @return results A list return data from pipe function calls
    **/
    function multiPipe(Pipe[] calldata pipes)
        external
        payable
        returns (bytes[] memory results)
    {
        results = IPipeline(PIPELINE).multiPipe(pipes);
    }

    /**
     * @notice Perform a list of advanced functio calls through Pipeline
     * Note: See IPipeline.AdvancedData and LibFunction.buildAdvancedCalldata
     * @param pipes a list of Advanced Pipes
     * @return results a list of return values from the advanced function calls
    **/
    function advancedPipe(AdvancedPipe[] calldata pipes, uint256 value)
        external
        payable
        returns (bytes[] memory results)
    {
        results = IPipeline(PIPELINE).advancedPipe{value: value}(pipes);
        LibEth.refundEth();
    }

    /**
     * @notice Perform 1 external function call through Pipeline with an Ether value
     * @param p A function call stored in Pipe struct
     * @param value The Ether value to send in the transaction
     * @return result The function call return data
    **/
    function etherPipe(Pipe calldata p, uint256 value)
        external
        payable
        returns (bytes memory result)
    {
        result = IPipeline(PIPELINE).pipe{value: value}(p);
        LibEth.refundEth();
    }

    /**
     * @notice View function to return the result of a function call
     * @param p A function call stored in Pipe struct
     * @return result The function call return data
    **/
    function readPipe(Pipe calldata p)
        external
        view
        returns (bytes memory result)
    {
        bool success;
        // Use a static call to ensure no state modification
        (success, result) = p.target.staticcall(p.data);
        LibFunction.checkReturn(success, result);
    }
}
