// SPDX-License-Identifier: MIT
pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {LibAppStorage, Storage, AppStorage} from "../LibAppStorage.sol";
import {LibWhitelistedTokens} from "./LibWhitelistedTokens.sol";
import {LibTokenSilo} from "./LibTokenSilo.sol";
import {C} from "../../C.sol";

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
    function setBit(bytes4 bitMask, uint256 bitIndex) internal pure returns (bytes4) {
        return bitMask | (bytes1(0x01) << bitIndex);
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
    function isBitSet(bytes4 bitMask, uint256 bitIndex) internal pure returns (bool) {
        return (bitMask >> bitIndex) & bytes4(0x00000001) == bytes4(0x00000001);
    }

    /**
     * @notice updates a bit for a given index in a bitmask.
     */
    function _updateMask(bytes4 bitMask, uint256 bitIndex) internal pure returns (bytes4) {
        return bitMask | (bytes1(0x01) << bitIndex);
    }
}
