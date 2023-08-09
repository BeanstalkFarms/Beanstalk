// SPDX-License-Identifier: MIT

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

/**
 * @title Instantaneous Pumps provide an Oracle for instantaneous reserves.
 */
interface IInstantaneousPump {
    /**
     * @notice Reads instantaneous reserves from the Pump
     * @param well The address of the Well
     * @return reserves The instantaneous balanecs tracked by the Pump
     */
    function readInstantaneousReserves(
        address well,
        bytes memory data
    ) external view returns (uint[] memory reserves);
}
