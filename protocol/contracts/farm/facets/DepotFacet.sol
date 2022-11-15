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
 * @author Publius
 * @notice DepotFacet wraps Pipeline's Pipe functions to facilitate the loading of non-Ether assets in Pipeline
 * in the same transaction that loads Ether, Pipes calls to other protocols and unloads Pipeline.
 **/

contract DepotFacet {
    address private constant PIPELINE =
        0xb1b300007b05D708a4BBFE71aAF64fe0B27a0125; // TO DO: Update with final address.

    /**
     * @notice Pipe a PipeCall through Pipeline.
     * @param p PipeCall to pipe through Pipeline
     * @return result PipeCall return value
    **/
    function pipe(PipeCall calldata p)
        external
        payable
        returns (bytes memory result)
    {
        result = IPipeline(PIPELINE).pipe(p);
    }


    /**
     * @notice Pipe multiple PipeCalls through Pipeline.
     * Does not support sending Ether in the call
     * @param pipes list of PipeCalls to pipe through Pipeline
     * @return results list of return values from each PipeCall
    **/
    function multiPipe(PipeCall[] calldata pipes)
        external
        payable
        returns (bytes[] memory results)
    {
        results = IPipeline(PIPELINE).multiPipe(pipes);
    }

    /**
     * @notice Pipe multiple AdvancedPipeCalls through Pipeline.
     * @param pipes list of AdvancedPipeCalls to pipe through Pipeline
     * @return results list of return values from each AdvancedPipeCall
    **/
    function advancedPipe(AdvancedPipeCall[] calldata pipes, uint256 value)
        external
        payable
        returns (bytes[] memory results)
    {
        results = IPipeline(PIPELINE).advancedPipe{value: value}(pipes);
        LibEth.refundEth();
    }

    /**
     * @notice Pipe a PipeCall through Pipeline with an Ether value.
     * @param p PipeCall to pipe through Pipeline
     * @param value Ether value to send in Pipecall
     * @return result PipeCall return value
    **/
    function etherPipe(PipeCall calldata p, uint256 value)
        external
        payable
        returns (bytes memory result)
    {
        result = IPipeline(PIPELINE).pipe{value: value}(p);
        LibEth.refundEth();
    }

    /**
     * @notice Return the return value of a PipeCall without executing it.
     * @param p PipeCall to execute with a staticcall
     * @return result PipeCall return value
    **/
    function readPipe(PipeCall calldata p)
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
