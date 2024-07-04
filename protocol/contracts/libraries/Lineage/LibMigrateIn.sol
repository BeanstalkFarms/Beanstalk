// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {AppStorage} from "contracts/libraries/LibAppStorage.sol";

/**
 * @title LibMigrateIn
 * @author funderbrker
 * @notice Library handling inbound migration and minting of protocol assets.
 */
library LibMigrateIn {
    // Definitions must match source migration definitions. May require multiple definitions.
    struct Deposit {}
    struct Plot {}
    struct Fertilizer {}

    // Mint assets locally.
    // Underlying external ERC20s have already been transferred to destination beanstalk.
    // msg.sender == source instance
    function migrateInDeposits(address user, bytes[] deposits) internal;
    function migrateInPlots(address user, bytes[] plots) internal;
    function migrateInFertilizer(address user, bytes[] fertilizer) internal;
}
