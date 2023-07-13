// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @title IPump defines the interface for a Pump.
 *
 * @dev Pumps are on-chain oracles that are updated upon each interaction with a {IWell}.
 * When reading a Pump, always verify the Pump's functionality.
 */
interface IPump {
    /**
     * @notice Updates the Pump with the given reserves.
     * @param reserves The previous reserves of the tokens in the Well.
     * @param data data specific to the Well
     * @dev Pumps are updated every time a user swaps, adds liquidity, or
     * removes liquidity from a Well.
     */
    function update(uint[] calldata reserves, bytes calldata data) external;
}
