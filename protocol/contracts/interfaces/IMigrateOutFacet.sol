// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {LibMigrateOut} from "contracts/libraries/Lineage/LibMigrateOut.sol";

interface IMigrateOutFacet {
    function migrateOut(
        address destination,
        LibMigrateOut.SourceDeposit[] calldata sourceDeposits,
        LibMigrateOut.SourcePlot[] calldata sourcePlots,
        LibMigrateOut.SourceFertilizer[] calldata sourceFertilizer,
        bytes calldata data
    ) external;
}
