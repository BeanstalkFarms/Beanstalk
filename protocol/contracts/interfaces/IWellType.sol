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
    function getX(
        uint256 j,
        uint128[] memory xs,
        uint256 d
    ) external view returns (uint256 x);

    function getD(
        uint128[] memory xs
    ) external view returns (uint256 d);
}