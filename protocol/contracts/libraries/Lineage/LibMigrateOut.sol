// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/libraries/LibAppStorage.sol";

/**
 * @title LibMigrateOut
 * @author funderbrker
 * @notice Library handling outbound migration and burning of protocol assets.
 */
library LibMigrateOut {
    // Need to define structs locally to contain additional migration information.
    struct Deposit {}
    struct Plot {}
    struct Fertilizer {}

    /**
     * @notice Sends underlying assets and burns deposits according to this fork's configuration.
     * @return The set of deposits to migrate, encoded as bytes.
     */
    function migrateOutDeposits() internal returns (bytes[] deposits);

    /**
     * @notice Burns plots, according to this fork's configuration.
     * @return The plots to migrate, encoded as bytes.
     */
    function migrateOutPlots() internal returns (bytes[] plots);

    /**
     * @notice Burns Fertilizer, according to this fork's configuration.
     * @return The Fertilizer to migrate, encoded as bytes.
     */
    function migrateOutFertilizer() internal returns (bytes[] fertilizer) {}
}
