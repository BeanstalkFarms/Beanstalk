/**
 * SPDX-License-Identifier: MIT
**/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @author Publius
 * @title Pump Interface
**/
interface IPump {
    function updatePump(bytes calldata pumpData, bytes32 wellPumpId, uint128[] calldata balances, uint32 blocksPassed) external;
    function readPump(bytes calldata pumpData, bytes32 wellPumpId, uint256 n) view external returns (uint256[] memory balances);
}