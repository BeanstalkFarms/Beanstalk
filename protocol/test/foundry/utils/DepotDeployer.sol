/**
 * SPDX-License-Identifier: MIT
 **/
pragma solidity ^0.8.20;
pragma abicoder v2;

import {Utils, console} from "test/foundry/utils/Utils.sol";
import {LibConstant} from "test/foundry/utils/LibConstant.sol";

/**
 * @title DepotDeployer
 * @author Brean
 * @notice Test helper contract to deploy Depot.
 */
contract DepotDeployer is Utils {
    function initDepot(bool verbose) internal {
        deployCodeTo("Pipeline.sol", LibConstant.PIPELINE);
        if (verbose) console.log("Pipeline deposited at: %s", LibConstant.PIPELINE);
    }
}
