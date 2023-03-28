/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibEth} from "../../libraries/Token/LibEth.sol";
import {LibFunction} from "../../libraries/LibFunction.sol";

/**
 * @title Farm Facet
 * @author Beasley, Publius
 * @notice Perform multiple Beanstalk functions calls in a single transaction using Farm calls. 
 * Any function stored in Beanstalk's EIP-2535 DiamondStorage can be called as a Farm call. (https://eips.ethereum.org/EIPS/eip-2535)
 **/

// AdvancedFarmCall is a Farm call that can use a Clipboard.
// See LibFunction.useClipboard for details
struct AdvancedFarmCall {
    bytes callData;
    bytes clipboard;
}

contract FarmFacet {
    AppStorage internal s;

    /**
     * @notice Execute multiple Farm calls.
     * @param data The encoded function data for each of the calls
     * @return results The return data from each of the calls
    **/
    function farm(bytes[] calldata data)
        external
        payable
        withEth
        returns (bytes[] memory results)
    {
        results = new bytes[](data.length);
        for (uint256 i; i < data.length; ++i) {
            results[i] = _farm(data[i]);
        }
    }

    /**
     * @notice Execute multiple AdvancedFarmCalls.
     * @param data The encoded function data for each of the calls to make to this contract
     * See LibFunction.buildAdvancedCalldata for details on advanced data
     * @return results The results from each of the calls passed in via data
    **/
    function advancedFarm(AdvancedFarmCall[] calldata data)
        external
        payable
        withEth
        returns (bytes[] memory results)
    {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; ++i) {
            results[i] = _advancedFarm(data[i], results);
        }
    }

    function _advancedFarm(AdvancedFarmCall calldata data, bytes[] memory returnData)
        internal
        returns (bytes memory result)
    {
        bytes1 pipeType = data.clipboard[0];
        // 0x00 -> Static Call - Execute static call
        // else > Advanced Call - Use clipboard on and execute call
        if (pipeType == 0x00) {
            result = _farm(data.callData);
        } else {
            result = LibFunction.useClipboard(data.callData, data.clipboard, returnData);
            _farmMem(result);
        }
    }

    // delegatecall a Beanstalk function using calldata data
    function _farm(bytes calldata data) private returns (bytes memory result) {
        bytes4 selector; bool success;
        assembly { selector := calldataload(data.offset) }
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }

    // delegatecall a Beanstalk function using memory data
    function _farmMem(bytes memory data) private returns (bytes memory result) {
        bytes4 selector; bool success;
        assembly { selector := mload(add(data, 32)) }
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }

    // signals to Beanstalk functions that they should not refund Eth 
    // at the end of the function because the function is wrapped in a Farm function
    modifier withEth() {
        if (msg.value > 0) s.isFarm = 2;
        _;
        if (msg.value > 0) {
            s.isFarm = 1;
            LibEth.refundEth();
        }
    }
}
