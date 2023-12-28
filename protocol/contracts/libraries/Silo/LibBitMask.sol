// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibAppStorage, Storage, AppStorage} from "../LibAppStorage.sol";
import {LibWhitelistedTokens} from "./LibWhitelistedTokens.sol";
import {LibTokenSilo} from "./LibTokenSilo.sol";
import {C} from "../../C.sol";
import "hardhat/console.sol";

/**
 * @title LibBitMask
 * @author Brean
 * @notice Helper BitMask Library
 * @dev Each whitelisted (or previously whitelisted) asset is assigned a bit in a bitmask.
 * This library helps with bitmask operations.
 *
 */
library LibBitMask {

    /**
     * @notice sets a bit for a given index in a bitmask.
     * @param bitMask mask to set bit in.
     * @param bitIndex index to enable.
     */
    function setBit(bytes4 bitMask, uint256 bitIndex) internal view returns (bytes4) {
        console.log("setting bit. bit is currently: ");
        console.logBytes4(bitMask);
        console.log("bit that is being changed:", bitIndex);
        console.log("bit moved:");
        console.logBytes4(bytes4(0x00000001) << bitIndex);
        return bitMask | (bytes4(0x00000001) << bitIndex);
    }

    /**
     * @notice clears bitmask.
     */
    function clearMask(bytes4) internal pure returns (bytes4) {
        return 0x00;
    }

    /**
     * @notice checks if a bit is set for a given index in a bitmask.
     */
    function isBitSet(bytes4 bitMask, uint256 bitIndex) internal view returns (bool) {
        console.log("bitMask");
        console.logBytes4(bitMask);
        console.log("bitIndex: ", bitIndex);
        console.log("bitMask >> bitIndex:");
        console.logBytes4(bitMask >> bitIndex);
        return (bitMask >> bitIndex) & bytes4(0x00000001) == bytes4(0x00000001);
    }

    /**
     * @notice updates a bit for a given index in a bitmask.
     */
    function _updateMask(bytes4 bitMask, uint256 bitIndex) internal pure returns (bytes4) {
        return bitMask | (bytes1(0x01) << bitIndex);
    }
}
