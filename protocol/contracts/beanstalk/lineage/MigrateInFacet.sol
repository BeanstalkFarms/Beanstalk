/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {AppStorage} from "contracts/beanstalk/storage/AppStorage.sol";
import {Invariable} from "contracts/beanstalk/Invariable.sol";
import {LibMigrateIn} from "contracts/libraries/Lineage/LibMigrateIn.sol";

/**
 * @title MigrateInFacet
 * @author funderbrker
 * @notice Destination instance logic for receiving migrated assets from another version.
 * @notice Destination has knowledge of valid Sources and their configurations at deployment time.
 **/
contract MigrateInFacet is Invariable {
    AppStorage internal s;
    /**
     * @notice Process the inbound migration locally.
     * @dev Reverts if failure to mint assets or handle migration in.
     */
    function migrateIn(
        address user,
        bytes[] calldata deposits,
        bytes[] calldata plots,
        bytes[] calldata fertilizer,
        bytes calldata // data
    ) external fundsSafu {
        require(s.sys.lineage.supportedSources[msg.sender], "Unsupported source");

        LibMigrateIn.migrateInDeposits(user, deposits);
        LibMigrateIn.migrateInPlots(user, plots);
        LibMigrateIn.migrateInFertilizer(user, fertilizer);
    }
}
