// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

interface IDelegation{
    function clearDelegate(bytes32 _id) external;
    function setDelegate(bytes32 _id, address _delegate) external;
}