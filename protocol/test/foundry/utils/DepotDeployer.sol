/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";

/**
 * @title DepotDeployer
 * @author Brean
 * @notice Test helper contract to deploy Depot.
 */
contract DepotDeployer is Utils {
    address payable PIPELINE = payable(0xb1bE000644bD25996b0d9C2F7a6D6BA3954c91B0);
    address DEPOT = address(0xDEb0f00071497a5cc9b4A6B96068277e57A82Ae2);

    function initDepot(bool verbose) internal {
        deployCodeTo("Pipeline.sol", PIPELINE);
        if (verbose) console.log("Pipeline deposited at: %s", PIPELINE);
    }
}
