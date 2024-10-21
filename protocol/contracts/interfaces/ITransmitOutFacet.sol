// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {LibTransmitOut} from "contracts/libraries/ForkSystem/LibTransmitOut.sol";

interface ITransmitOutFacet {
    function transmitOut(
        address destination,
        bytes[] calldata assets,
        bytes calldata data
    ) external;
}
