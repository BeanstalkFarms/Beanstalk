// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IMigrateInFacet {
    function migrateIn(
        bytes[] calldata deposits,
        bytes[] calldata plots,
        bytes[] calldata fertilizer,
        bytes calldata data
    ) external;
}