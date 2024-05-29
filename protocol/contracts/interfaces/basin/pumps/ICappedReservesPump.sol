// SPDX-License-Identifier: MIT

pragma solidity ^0.8.20;
pragma experimental ABIEncoderV2;

/**
 * @title ICappedReservesPump
 * @notice Provides an interface for Pumps which capped
 * reserves through the use of a cumulative reserve.
 */
interface ICappedReservesPump {
    function readCappedReserves(
        address well,
        bytes memory data
    ) external view returns (uint256[] memory cappedReserves);
}
