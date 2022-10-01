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

 struct DynamicData {
    bytes pre;
    bytes post;
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

    // Calls 1 farm function and inputs the return value into the second one.
    function dynamicFarm(
        bytes calldata data,
        uint256 packedTypes
    ) external payable returns (bytes[] memory results) {
        results = new bytes[](data);
        results[0] = _farm(data);
        results[1] = _dynamicFarm(abi.encode(preData1, results[0], dynamicData));
    }

    function dynamicFarm(bytes calldata data, DynamicData[] calldata dynamicData)
        external
        payable
        returns (bytes[] memory results)
    {
        results = new bytes[](dynamicData.length + 1);
        results[0] = _farm(data);
        for (uint256 i = 1; i < dynamicData.length; ++i) {
            results[i] = _dynamicFarm(
                abi.encode(data[i].pre, results[i - 1], dynamicData[i].post)
            );
        }
    }

    // Farm function using calldata
    function _farm(bytes calldata data) private returns (bytes memory result) {
        bytes4 selector;
        bool success;
        assembly {
            selector := calldataload(data.offset)
        }
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }

    // Farm function using memory
    function _dynamicFarm(
        DynamicData calldata d,
        bytes memory dynamic
    ) private returns (bytes memory result) {
        bytes memory data = LibFunction.injectCallData(d.pre, dynamic, d.post);
        bool success;
        bytes4 selector = abi.decode(data, (bytes4));
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }
}
