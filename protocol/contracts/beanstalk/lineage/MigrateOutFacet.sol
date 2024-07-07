/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibTractor} from "contracts/beanstalk/tractor/LibTractor.sol";
import {LibMigrateOut} from "contracts/libraries/Lineage/LibMigrateOut.sol";

/**
 * @title MigrateOutFacet
 * @author funderbrker
 * @notice Source instance logic for migrating assets to new version.
 * @notice Source instance has no knowledge of possible Destinations or their configurations.
 **/
contract MigrateOutFacet is Invariable {
    /**
     * @notice Process the outbound migration and transfer necessary assets to destination.
     * @dev Reverts if failure to burn assets or destination fails.
     */
    function migrateOut(address destination) external fundsSafu {
        bytes[] deposits = LibMigrateOut.migrateOutDeposits();
        bytes[] plots = LibMigrateOut.migrateOutPlots();
        bytes[] fertilizer = LibMigrateOut.migrateOutFertilizer();

        // Reverts if Destination fails to handle migrated assets.
        IMigrateInFacet(destination).migrateIn(
            LibTractor.user(),
            deposits,
            plots,
            fertilizer,
            abi.encode("")
        );
    }
}
