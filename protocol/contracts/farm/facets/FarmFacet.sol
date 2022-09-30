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
    function farmReturn(
        bytes calldata data0,
        bytes calldata preData1,
        bytes calldata postData1
    ) external payable returns (bytes[] memory results) {
        results = new bytes[](2);
        results[0] = _farm(data0);
        results[1] = _farmM(abi.encode(preData1, results[0], postData1));
    }

    // Calls any function with a static call and inputs it into a farm function.
    function farmStaticReturn(
        address target0,
        bytes calldata data0,
        bytes calldata preData1,
        bytes calldata postData1
    ) external payable returns (bytes[] memory results) {
        results = new bytes[](2);
        bool success;
        results[0] = _static(target0, data0);
        results[1] = _farmM(abi.encode(preData1, results[0], postData1));
    }

    // Farm function using calldata
    function _farm(bytes calldata data) private returns (bytes memory result) {
        bytes4 selector; bool success;
        assembly { selector := calldataload(data.offset) }
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }

    // Farm function using memory
    function _farmM(bytes memory data) private returns (bytes memory result) {
        bool success;
        bytes4 selector = abi.decode(data, (bytes4));
        address facet = LibFunction.facetForSelector(selector);
        (success, result) = facet.delegatecall(data);
        LibFunction.checkReturn(success, result);
    }

    function _static(address target, bytes calldata data) private returns (bytes memory result) {
        bool success;
        (success, result) = target.staticcall(data);
        LibFunction.checkReturn(success, result);
    }
}
