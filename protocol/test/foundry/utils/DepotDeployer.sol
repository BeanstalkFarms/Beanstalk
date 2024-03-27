/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity >=0.7.6 <0.9.0;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";

/**
 * @title DepotDeployer
 * @author Brean
 * @notice Test helper contract to deploy Depot.
 */
contract DepotDeployer is Utils {

    address PIPELINE = address(0xb1bE0000C6B3C62749b5F0c92480146452D15423);
    address DEPOT = address(0xDEb0f00071497a5cc9b4A6B96068277e57A82Ae2);

    function initDepot(bool verbose) internal {
        deployCodeTo("Pipeline.sol", PIPELINE);
        if(verbose) console.log("Pipeline deposited at: %s", PIPELINE);
        deployCodeTo("Depot.sol", DEPOT);
        if(verbose) console.log("Depot deposited at: %s", DEPOT);
    }
}
