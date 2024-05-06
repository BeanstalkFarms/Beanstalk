// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @title ICappedReservesPump
 * @notice Provides an interface for Pumps which capped
 * reserves through the use of a cumulative reserve.
 */
interface ICappedReservesPump {
    // TODO: Maybe not the best place to put this, perhaps in a MultiFlowPump interface?
    function readCappedReserves(
        address well,
        bytes memory data
    ) external view returns (uint256[] memory cappedReserves);
}
