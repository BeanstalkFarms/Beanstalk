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
 * @title Farmfacet - Users call any function in Beanstalk
 **/

 struct AdvancedData {
    bytes callData;
    bytes farmData;
 }

contract FarmFacet {
    AppStorage internal s;

    /*
     * Farm Function
     */

    function farm(bytes[] calldata data)
        external
        payable
        returns (bytes[] memory results)
    {
        if (msg.value > 0) s.isFarm = 2;
        results = new bytes[](data.length);
        for (uint256 i; i < data.length; ++i) {
            results[i] = _farm(data[i]);
        }
        if (msg.value > 0) {
            s.isFarm = 1;
            LibEth.refundEth();
        }
    }

    function advancedFarm(
        AdvancedData[] calldata data
    ) external payable returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; ++i) {
            results[i] = _advancedFarm(data[i], results);
        }
    }

    function _advancedFarm(
        AdvancedData calldata d,
        bytes[] memory returnData
    ) internal returns (bytes memory result) {
        byte pipeType = d.farmData[0];
        if (pipeType == 0x00) {
            result = _farm(d.callData);
        } else if (pipeType == 0x01) {
            (, bytes32 copyParams) = abi.decode(d.farmData, (uint256, bytes32));
            result = _farmMem(LibFunction.pasteBytes(returnData, d.callData, copyParams));
        } else if (pipeType == 0x02) {
            (, bytes32[] memory copyParams) = abi.decode(d.farmData, (uint256, bytes32[]));
            bytes memory callData = d.callData;
            for (uint i; i < copyParams.length; i++)
                callData = LibFunction.pasteBytes(returnData, callData, copyParams[i]);
            result = _farmMem(callData);
        }
        else {
            revert("Farm: Type not supported");
        }
    }

    // Farm function using calldata
    function _farm(bytes calldata data) private returns (bytes memory result) {
        bytes4 selector; bool success;
        assembly { selector := calldataload(data.offset) }
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }

    function _farmMem(bytes memory data) private returns (bytes memory result) {
        bool success;
        bytes4 selector = abi.decode(data, (bytes4));
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }
}
