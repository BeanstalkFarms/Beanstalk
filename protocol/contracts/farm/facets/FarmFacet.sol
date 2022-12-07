/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibEth} from "../../libraries/Token/LibEth.sol";
import {LibFarm} from "../../libraries/LibFarm.sol";

/**
 * @title Farm Facet
 * @notice Perform mutliple Beanstalk function calls in a single transaction
 **/
contract FarmFacet {
    AppStorage internal s;

    /**
     * @notice Call multiple functions in Beanstalk and return the data from all of them if they all succeed
     * @param data The encoded function data for each of the calls to make to this contract
     * @return results The results from each of the calls passed in via data
    **/
    function farm(bytes[] calldata data)
        external
        payable
        withEth
        returns (bytes[] memory results)
    {
        results = new bytes[](data.length);
        for (uint256 i; i < data.length; ++i) {
            results[i] = LibFarm.farm(data[i]);
        }
    }

    /**
     * @notice Perform a list of advanced function calls on Beanstalk
     * @param data The encoded function data for each of the calls to make to this contract
     * See LibFunction.buildAdvancedCalldata for details on advanced data
     * @return results The results from each of the calls passed in via data
    **/
    function advancedFarm(LibFarm.AdvancedData[] calldata data)
        external
        payable
        withEth
        returns (bytes[] memory results)
    {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; ++i) {
            results[i] = LibFarm.advancedFarm(data[i], results);
        }
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
