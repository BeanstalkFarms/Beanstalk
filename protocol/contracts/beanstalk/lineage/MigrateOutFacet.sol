/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibTractor} from "contracts/libraries/LibTractor.sol";
import {LibMigrateOut} from "contracts/libraries/Lineage/LibMigrateOut.sol";
import {IMigrateInFacet} from "contracts/interfaces/IMigrateInFacet.sol";

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
    function migrateOut(
        address destination,
        LibMigrateOut.SourceDeposit[] calldata sourceDeposits,
        LibMigrateOut.SourcePlot[] calldata sourcePlots,
        LibMigrateOut.SourceFertilizer[] calldata sourceFertilizer,
        bytes calldata // data
    ) external fundsSafu {
        bytes[] memory deposits = LibMigrateOut.migrateOutDeposits(
            LibTractor._user(),
            destination,
            sourceDeposits
        );
        bytes[] memory plots = LibMigrateOut.migrateOutPlots(LibTractor._user(), sourcePlots);
        bytes[] memory fertilizer = LibMigrateOut.migrateOutFertilizer(
            LibTractor._user(),
            sourceFertilizer
        );

        // Reverts if Destination fails to handle migrated assets.
        IMigrateInFacet(destination).migrateIn(
            LibTractor._user(),
            deposits,
            plots,
            fertilizer,
            abi.encode("")
        );
    }
}
