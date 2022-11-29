/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import "./LibEmaPump.sol";
import "./LibCumulativeSmaPump.sol";
import {IPump} from "../../../interfaces/IPump.sol";

/**
 * @author Publius
 * @title LibPump handles logic to update Pumps.
 **/

library LibPump {
    function updatePumps(bytes32 wh, bytes[] calldata pumps, uint128[] memory balances) internal {
        uint32 blocksPassed = uint32(block.number) - updateLastBlockNumber(wh, balances.length);
        if (blocksPassed == 0) return;
        for (uint256 i; i < pumps.length; ++i) {
            updatePump(wh, pumps[i], balances, blocksPassed);
        }
    }

    function updatePump(bytes32 wh, bytes calldata pump, uint128[] memory newBalances, uint32 blocksPassed) private {
        bytes32 slot = keccak256(abi.encode(wh, pump));
            address target;
            assembly { target := calldataload(sub(pump.offset,10)) }
            IPump(target).updatePump(pump[22:], slot, newBalances, blocksPassed);
    }

    function readPump(bytes32 wh, bytes calldata pump) internal view returns (uint256[] memory balances) {
        bytes32 slot = keccak256(abi.encode(wh, pump));
        byte pumpType = pump[0];
        if (pumpType == 0x00) {
            address target;
            assembly { target := calldataload(sub(pump.offset,10)) }
            balances = IPump(target).readPump(pump[22:], slot, uint8(pump[1]));
        } else if (pumpType == 0x01) {
            balances = LibEmaPump.readPump(slot, uint8(pump[1]));
        } else if (pumpType == 0x02) {
            balances = LibCumulativeSmaPump.readPump(slot, uint8(pump[1]));
        }
    }

    function readUpdatedPump(bytes32 wh, bytes calldata pump) internal returns (uint256[] memory balances) {
        uint32 blocksPassed = uint32(block.number) - updateLastBlockNumber(wh, uint8(pump[1]));
        if (blocksPassed > 0) {
            uint128[] memory newBalances = LibByteStorage.readUint128(wh, uint8(pump[1]));
            updatePump(wh, pump, newBalances, blocksPassed);
        }
        balances = readPump(wh, pump);
    }

    function getLastBlockNumber(bytes32 wh, uint256 n) internal view returns (uint32 lastBlockNumber) {
        uint256 offset = (n+1)/2;
        assembly { lastBlockNumber := sload(add(wh, offset)) }
    }

    function updateLastBlockNumber(bytes32 wh, uint256 n) internal returns (uint32 lastBlockNumber) {
        uint256 offset = (n+1)/2;
        assembly { lastBlockNumber := sload(add(wh, offset)) }
        uint32 blockNumber = uint32(block.number);
        assembly { sstore(add(wh, offset), blockNumber) }
    }
}