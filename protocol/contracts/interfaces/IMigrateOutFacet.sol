// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface IMigrateOutFacet {
    function migrateOut(
        address destination,
        bytes[] calldata deposits,
        bytes[] calldata plots,
        bytes[] calldata fertilizer, // someday can be deprecated/renamed
        bytes calldata data
    ) external;
}
