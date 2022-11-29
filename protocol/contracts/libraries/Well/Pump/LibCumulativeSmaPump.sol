/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "../../LibByteStorage.sol";

/**
 * @author Publius
 * @title LibCumulativeSmaPump provides an interface for an SMA pump
 **/

library LibCumulativeSmaPump {
    function updatePump(
        bytes32 slot,
        uint128[] memory balances,
        uint32 blocksPassed
    ) internal {
        uint256[] memory pumpBalances = LibByteStorage.readUint256(slot, balances.length);
        for (uint256 i; i < balances.length; ++i) {
            pumpBalances[i] = pumpBalances[i] + uint256(balances[i]) * blocksPassed; // SMA not possible
        }
        LibByteStorage.storeUint256(slot, pumpBalances);
    }

    function readPump(
        bytes32 wellPumpId,
        uint256 n
    ) internal view returns (uint256[] memory balances) {
        balances = LibByteStorage.readUint256(wellPumpId, n);
    }
}
