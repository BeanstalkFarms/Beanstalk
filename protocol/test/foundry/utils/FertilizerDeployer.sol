/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";
import {Fertilizer} from "contracts/tokens/Fertilizer/Fertilizer.sol";
import {IFertilizer} from "contracts/interfaces/IFertilizer.sol";

interface IOwner {
    function transferOwnership(address newOwner) external;
    function owner() external returns (address);
}

/**
 * @title FertilizerDeployer
 * @author Brean
 * @notice Test helper contract to deploy Fertilizer.
 */
contract FertilizerDeployer is Utils {
    address FERTILIZER;
    IFertilizer fertilizer;

    function initFertilizer(bool verbose) internal {
        deployCodeTo("MockFertilizer", FERTILIZER);
        if (verbose) console.log("MockFertilizer deployed at: ", FERTILIZER);
        fertilizer = IFertilizer(FERTILIZER);
    }

    function transferFertilizerOwnership(address newOwner) internal {
        vm.prank(IOwner(FERTILIZER).owner());
        IOwner(FERTILIZER).transferOwnership(newOwner);
    }

    function mintFertilizer() internal {} // TODO

    function mockMintFertilizer() internal {}

    function mockIncrementFertilizer() internal {}
}
