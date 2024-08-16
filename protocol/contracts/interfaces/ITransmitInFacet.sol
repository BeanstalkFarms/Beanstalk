// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

interface ITransmitInFacet {
    function transmitIn(
        address user,
        bytes[] calldata deposits,
        bytes[] calldata plots,
        bytes[] calldata fertilizer,
        bytes calldata data
    ) external;
}
