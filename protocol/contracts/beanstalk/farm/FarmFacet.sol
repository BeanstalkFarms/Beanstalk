/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {AppStorage} from "../storage/AppStorage.sol";
import {LibDiamond} from "../../libraries/LibDiamond.sol";
import {LibEth} from "../../libraries/Token/LibEth.sol";
import {AdvancedFarmCall, LibFarm} from "../../libraries/LibFarm.sol";
import {LibFunction} from "../../libraries/LibFunction.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {ReentrancyGuard} from "contracts/beanstalk/ReentrancyGuard.sol";

/**
 * @title Farm Facet
 * @author Beasley, Publius
 * @notice Perform multiple Beanstalk functions calls in a single transaction using Farm calls.
 * Any function stored in Beanstalk's EIP-2535 DiamondStorage can be called as a Farm call. (https://eips.ethereum.org/EIPS/eip-2535)
 **/

contract FarmFacet is Invariable, ReentrancyGuard {
    /**
     * @notice Execute multiple Farm calls.
     * @param data The encoded function data for each of the calls
     * @return results The return data from each of the calls
     **/
    function farm(
        bytes[] calldata data
    ) external payable fundsSafu nonReentrantFarm returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i; i < data.length; ++i) {
            results[i] = LibFarm._farm(data[i]);
        }
        LibEth.refundEth();
    }

    /**
     * @notice Execute multiple AdvancedFarmCalls.
     * @param data The encoded function data for each of the calls to make to this contract
     * See LibFunction.buildAdvancedCalldata for details on advanced data
     * @return results The results from each of the calls passed in via data
     **/
    function advancedFarm(
        AdvancedFarmCall[] calldata data
    ) external payable fundsSafu nonReentrantFarm returns (bytes[] memory results) {
        results = new bytes[](data.length);
        for (uint256 i = 0; i < data.length; ++i) {
            results[i] = LibFarm._advancedFarm(data[i], results);
        }
        LibEth.refundEth();
    }
}
