// SPDX-License-Identifier: MIT

pragma solidity ^0.8.17;

import {IPump} from "@wells/interfaces/pumps/IPump.sol";
import {IWell} from "@wells/interfaces/IWell.sol";
import {IInstantaneousPump} from "@wells/interfaces/pumps/IInstantaneousPump.sol";
import {ICumulativePump} from "@wells/interfaces/pumps/ICumulativePump.sol";
import {ABDKMathQuad} from "@wells/libraries/ABDKMathQuad.sol";
import {LibBytes16} from "@wells/libraries/LibBytes16.sol";
import {LibLastReserveBytes} from "@wells/libraries/LibLastReserveBytes.sol";
import {SafeCast} from "@wells-lib/openzeppelin-contracts/contracts/utils/math/SafeCast.sol";

import {console} from "hardhat/console.sol";

/**
 * @title GeoEmaAndCumSmaPump
 * @author Publius
 * @notice Stores a geometric EMA and cumulative geometric SMA for each reserve.
 * @dev A Pump designed for use in Beanstalk with 2 tokens.
 *
 * This Pump has 3 main features:
 *  1. Multi-block MEV resistence reserves
 *  2. MEV-resistant Geometric EMA intended for instantaneous reserve queries
 *  3. MEV-resistant Cumulative Geometric intended for SMA reserve queries
 *
 * Note: If an `update` call is made with a reserve of 0, the Geometric mean oracles will be set to 0.
 * Each Well is responsible for ensuring that an `update` call cannot be made with a reserve of 0.
 */
contract MockGeoEmaAndCumSmaPump is IPump, IInstantaneousPump, ICumulativePump {
    using SafeCast for uint;
    using LibLastReserveBytes for bytes32;
    using LibBytes16 for bytes32;
    using ABDKMathQuad for bytes16;
    using ABDKMathQuad for uint;

    bytes16 immutable LOG_MAX_INCREASE;
    bytes16 immutable LOG_MAX_DECREASE;
    bytes16 immutable A;
    uint immutable BLOCK_TIME;

    struct Reserves {
        uint40 lastTimestamp;
        bytes16[] lastReserves;
        bytes16[] emaReserves;
        bytes16[] cumulativeReserves;
    }

    /**
     * @param _maxPercentIncrease The maximum percent increase allowed in a single block. Must be in quadruple precision format (See {ABDKMathQuad}).
     * @param _maxPercentDecrease The maximum percent decrease allowed in a single block. Must be in quadruple precision format (See {ABDKMathQuad}).
     * @param _blockTime The block time in the current EVM in seconds.
     * @param _A The geometric EMA constant. Must be in quadruple precision format (See {ABDKMathQuad}).
     */
    constructor(bytes16 _maxPercentIncrease, bytes16 _maxPercentDecrease, uint _blockTime, bytes16 _A) {
        LOG_MAX_INCREASE = ABDKMathQuad.ONE.add(_maxPercentIncrease).log_2();
        require(_maxPercentDecrease < ABDKMathQuad.ONE);
        LOG_MAX_DECREASE = ABDKMathQuad.ONE.sub(_maxPercentDecrease).log_2();
        BLOCK_TIME = _blockTime;
        A = _A;
    }

    //////////////////// PUMP ////////////////////

    function update(uint[] calldata reserves, bytes calldata) external {

        console.log("Updating With:");
        console.log(reserves[0]);
        console.log(reserves[1]);

        uint length = reserves.length;
        Reserves memory b;

        // All reserves are stored starting at the msg.sender address slot in storage.
        bytes32 slot = getSlotForAddress(msg.sender);

        // Read: Last Timestamp & Last Reserves
        (, b.lastTimestamp, b.lastReserves) = slot.readLastReserves();

        // If the last timestamp is 0, then the pump has never been used before.
        if (b.lastTimestamp == 0) {
            for (uint i; i < length; ++i) {
                // If a reserve is 0, then the pump cannot be initialized.
                if (reserves[i] == 0) return;
            }
            _init(slot, uint40(block.timestamp), reserves);
            return;
        }

        // Read: Cumulative & EMA Reserves
        // Start at the slot after `b.lastReserves`
        uint numSlots = getSlotsOffset(length);
        assembly {
            slot := add(slot, numSlots)
        }
        b.emaReserves = slot.readBytes16(length);
        assembly {
            slot := add(slot, numSlots)
        }
        b.cumulativeReserves = slot.readBytes16(length);

        bytes16 aN;
        bytes16 deltaTimestampBytes;
        bytes16 blocksPassed;
        // Isolate in brackets to prevent stack too deep errors
        {
            uint deltaTimestamp = getDeltaTimestamp(b.lastTimestamp);
            aN = A.powu(deltaTimestamp);
            deltaTimestampBytes = deltaTimestamp.fromUInt();
            // Relies on the assumption that a block can only occur every `BLOCK_TIME` seconds.
            blocksPassed = (deltaTimestamp / BLOCK_TIME).fromUInt();
        }

        for (uint i; i < length; ++i) {
            // Use a minimum of 1 for reserve. Geometric means will be set to 0 if a reserve is 0.
            b.lastReserves[i] =
                _capReserve(b.lastReserves[i], (reserves[i] > 0 ? reserves[i] : 1).fromUIntToLog2(), blocksPassed);
            b.emaReserves[i] = b.lastReserves[i].mul((ABDKMathQuad.ONE.sub(aN))).add(b.emaReserves[i].mul(aN));
            b.cumulativeReserves[i] = b.cumulativeReserves[i].add(b.lastReserves[i].mul(deltaTimestampBytes));
        }

        // Write: Cumulative & EMA Reserves
        // Order matters: work backwards to avoid using a new memory var to count up
        slot.storeBytes16(b.cumulativeReserves);
        assembly {
            slot := sub(slot, numSlots)
        }
        slot.storeBytes16(b.emaReserves);
        assembly {
            slot := sub(slot, numSlots)
        }

        // Write: Last Timestamp & Last Reserves
        slot.storeLastReserves(uint40(block.timestamp), b.lastReserves);
    }

    /**
     * @dev On first update for a particular Well, initialize oracle with
     * reserves data.
     */
    function _init(bytes32 slot, uint40 lastTimestamp, uint[] memory reserves) internal {
        uint length = reserves.length;
        bytes16[] memory byteReserves = new bytes16[](length);

        console.log("initializing");

        // Skip {_capReserve} since we have no prior reference

        for (uint i = 0; i < length; ++i) {
            byteReserves[i] = reserves[i].fromUIntToLog2();
        }

        // Write: Last Timestamp & Last Reserves
        slot.storeLastReserves(lastTimestamp, byteReserves);

        // Write: EMA Reserves
        // Start at the slot after `byteReserves`
        uint numSlots = getSlotsOffset(byteReserves.length);
        assembly {
            slot := add(slot, numSlots)
        }
        slot.storeBytes16(byteReserves); // EMA Reserves
    }

    //////////////////// LAST RESERVES ////////////////////

    function readLastReserves(address well) public view returns (uint[] memory reserves) {
        bytes32 slot = getSlotForAddress(well);
        (,, bytes16[] memory bytesReserves) = slot.readLastReserves();
        reserves = new uint[](bytesReserves.length);
        uint length = reserves.length;
        for (uint i = 0; i < length; ++i) {
            reserves[i] = bytesReserves[i].pow_2ToUInt();
        }
    }

    /**
     * @dev Adds a cap to the reserve value to prevent extreme changes.
     *
     *  Linear space:
     *     max reserve = (last reserve) * ((1 + MAX_PERCENT_CHANGE_PER_BLOCK) ^ blocks)
     *
     *  Log space:
     *     log2(max reserve) = log2(last reserve) + blocks*log2(1 + MAX_PERCENT_CHANGE_PER_BLOCK)
     *
     *     `bytes16 lastReserve`      <- log2(last reserve)
     *     `bytes16 blocksPassed`     <- log2(blocks)
     *     `bytes16 LOG_MAX_INCREASE` <- log2(1 + MAX_PERCENT_CHANGE_PER_BLOCK)
     *
     *     ∴ `maxReserve = lastReserve + blocks*LOG_MAX_INCREASE`
     *
     */
    function _capReserve(
        bytes16 lastReserve,
        bytes16 reserve,
        bytes16 blocksPassed
    ) internal view returns (bytes16 cappedReserve) {
        // Reserve decreasing (lastReserve > reserve)
        if (lastReserve.cmp(reserve) == 1) {
            bytes16 minReserve = lastReserve.add(blocksPassed.mul(LOG_MAX_DECREASE));
            // if reserve < minimum reserve, set reserve to minimum reserve
            if (minReserve.cmp(reserve) == 1) reserve = minReserve;
        }
        // Rerserve Increasing or staying the same.
        else {
            bytes16 maxReserve = blocksPassed.mul(LOG_MAX_INCREASE);
            maxReserve = lastReserve.add(maxReserve);
            // If reserve > maximum reserve, set reserve to maximum reserve
            if (reserve.cmp(maxReserve) == 1) reserve = maxReserve;
        }
        cappedReserve = reserve;
    }

    //////////////////// EMA RESERVES ////////////////////

    function readLastInstantaneousReserves(address well) public view returns (uint[] memory reserves) {
        bytes32 slot = getSlotForAddress(well);
        uint8 n = slot.readN();
        uint offset = getSlotsOffset(n);
        assembly {
            slot := add(slot, offset)
        }
        bytes16[] memory byteReserves = slot.readBytes16(n);
        reserves = new uint[](n);
        uint length = reserves.length;
        for (uint i = 0; i < length; ++i) {
            reserves[i] = byteReserves[i].pow_2ToUInt();
        }
    }

    function readInstantaneousReserves(address well, bytes memory) public view returns (uint[] memory emaReserves) {
        bytes32 slot = getSlotForAddress(well);
        uint[] memory reserves = IWell(well).getReserves();
        (uint8 n, uint40 lastTimestamp, bytes16[] memory lastReserves) = slot.readLastReserves();
        uint offset = getSlotsOffset(n);
        assembly {
            slot := add(slot, offset)
        }
        bytes16[] memory lastEmaReserves = slot.readBytes16(n);
        uint deltaTimestamp = getDeltaTimestamp(lastTimestamp);
        bytes16 blocksPassed = (deltaTimestamp / BLOCK_TIME).fromUInt();
        bytes16 aN = A.powu(deltaTimestamp);
        emaReserves = new uint[](n);
        uint length = reserves.length;
        for (uint i = 0; i < length; ++i) {
            lastReserves[i] = _capReserve(lastReserves[i], reserves[i].fromUIntToLog2(), blocksPassed);
            emaReserves[i] =
                lastReserves[i].mul((ABDKMathQuad.ONE.sub(aN))).add(lastEmaReserves[i].mul(aN)).pow_2ToUInt();
        }
    }

    //////////////////// CUMULATIVE RESERVES ////////////////////

    /**
     * @notice Read the latest cumulative reserves of `well`.
     */
    function readLastCumulativeReserves(address well) public view returns (bytes16[] memory reserves) {
        bytes32 slot = getSlotForAddress(well);
        uint8 n = slot.readN();
        uint offset = getSlotsOffset(n) << 1;
        assembly {
            slot := add(slot, offset)
        }
        reserves = slot.readBytes16(n);
    }

    function readCumulativeReserves(address well, bytes memory) public view returns (bytes memory cumulativeReserves) {
        bytes16[] memory byteCumulativeReserves = _readCumulativeReserves(well);
        cumulativeReserves = abi.encode(byteCumulativeReserves);
    }

    function _readCumulativeReserves(address well) internal view returns (bytes16[] memory cumulativeReserves) {
        bytes32 slot = getSlotForAddress(well);
        uint[] memory reserves = IWell(well).getReserves();
        (uint8 n, uint40 lastTimestamp, bytes16[] memory lastReserves) = slot.readLastReserves();
        uint offset = getSlotsOffset(n) << 1;
        assembly {
            slot := add(slot, offset)
        }
        cumulativeReserves = slot.readBytes16(n);
        uint deltaTimestamp = getDeltaTimestamp(lastTimestamp);
        bytes16 deltaTimestampBytes = deltaTimestamp.fromUInt();
        bytes16 blocksPassed = (deltaTimestamp / BLOCK_TIME).fromUInt();
        // Currently, there is so support for overflow.
        for (uint i = 0; i < cumulativeReserves.length; ++i) {
            lastReserves[i] = _capReserve(lastReserves[i], reserves[i].fromUIntToLog2(), blocksPassed);
            cumulativeReserves[i] = cumulativeReserves[i].add(lastReserves[i].mul(deltaTimestampBytes));
        }
    }

    function readTwaReserves(
        address well,
        bytes calldata startCumulativeReserves,
        uint startTimestamp,
        bytes memory
    ) public view returns (uint[] memory twaReserves, bytes memory cumulativeReserves) {
        bytes16[] memory byteCumulativeReserves = _readCumulativeReserves(well);
        bytes16[] memory byteStartCumulativeReserves = abi.decode(startCumulativeReserves, (bytes16[]));
        twaReserves = new uint[](byteCumulativeReserves.length);

        // Overflow is desired on `startTimestamp`, so SafeCast is not used.
        bytes16 deltaTimestamp = getDeltaTimestamp(uint40(startTimestamp)).fromUInt();
        require(deltaTimestamp != bytes16(0), "Well: No time passed");
        for (uint i = 0; i < byteCumulativeReserves.length; ++i) {
            // Currently, there is no support for overflow.
            twaReserves[i] =
                (byteCumulativeReserves[i].sub(byteStartCumulativeReserves[i])).div(deltaTimestamp).pow_2ToUInt();
        }
        cumulativeReserves = abi.encode(byteCumulativeReserves);
    }

    //////////////////// HELPERS ////////////////////

    /**
     * @dev Convert an `address` into a `bytes32` by zero padding the right 12 bytes.
     */
    function getSlotForAddress(address addressValue) internal pure returns (bytes32) {
        return bytes32(bytes20(addressValue)); // Because right padded, no collision on adjacent
    }

    /**
     * @dev Get the starting byte of the slot that contains the `n`th element of an array.
     */
    function getSlotsOffset(uint n) internal pure returns (uint) {
        return ((n - 1) / 2 + 1) << 5; // Maybe change to n * 32?
    }

    /**
     * @dev Get the delta between the current and provided timestamp as a `uint256`.
     */
    function getDeltaTimestamp(uint40 lastTimestamp) internal view returns (uint) {
        return uint(uint40(block.timestamp) - lastTimestamp);
    }
}
