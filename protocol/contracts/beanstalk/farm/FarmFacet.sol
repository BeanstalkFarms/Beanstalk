/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.7.6;
pragma experimental ABIEncoderV2;

import {AppStorage} from "../AppStorage.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibEth} from "../../libraries/Token/LibEth.sol";
import {LibFarm} from "../../libraries/LibFarm.sol";
import {LibFunction} from "../../libraries/LibFunction.sol";

/**
 * @title Farm Facet
 * @author Beasley, Publius
 * @notice Perform multiple Beanstalk functions calls in a single transaction using Farm calls. 
 * Any function stored in Beanstalk's EIP-2535 DiamondStorage can be called as a Farm call. (https://eips.ethereum.org/EIPS/eip-2535)
 **/
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
            results[i] = LibFarm.farm(data[i]);
        }
    }

    /**
     * @notice Execute multiple AdvancedFarmCalls.
     * @param data The encoded function data for each of the calls to make to this contract
     * See LibFunction.buildAdvancedCalldata for details on advanced data
     * @return results The results from each of the calls passed in via data
    **/
    function advancedFarm(LibFarm.AdvancedFarmCall[] calldata data)
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