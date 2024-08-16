// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;

import {LibTransmitOut} from "contracts/libraries/ForkSystem/LibTransmitOut.sol";

interface ITransmitOutFacet {
    function transmitOut(
        address destination,
        LibTransmitOut.SourceDeposit[] calldata sourceDeposits,
        LibTransmitOut.SourcePlot[] calldata sourcePlots,
        LibTransmitOut.SourceFertilizer[] calldata sourceFertilizer,
        bytes calldata data
    ) external;
}
