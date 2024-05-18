/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";
import {Fertilizer} from "contracts/tokens/Fertilizer/Fertilizer.sol";
import {C} from "contracts/C.sol";

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
    function initFertilizer(bool verbose) internal {
        address fertilizerAddress = C.fertilizerAddress();
        deployCodeTo("Fertilizer", fertilizerAddress);
        if (verbose) console.log("Fertilizer deployed at: ", fertilizerAddress);
    }

    function transferFertilizerOwnership(address newOwner) internal {
        address fertilizer = C.fertilizerAddress();
        vm.prank(IOwner(fertilizer).owner());
        IOwner(fertilizer).transferOwnership(newOwner);
    }

    function mintFertilizer() internal {} // TODO

    function mockMintFertilizer() internal {}

    function mockIncrementFertilizer() internal {}
}
