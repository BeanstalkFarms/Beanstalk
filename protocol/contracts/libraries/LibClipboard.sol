/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import {LibBytes} from "./LibBytes.sol";
import {LibTractor} from "./LibTractor.sol";

//
/**
 * @title LibClipboard
 * @author funderbrker
 * @notice LibClipboard offers utility functions for composing Pipeline clipboards.
 * @dev Not gas golfed for on-chain usage. These functions are intended to be standardized client helpers.
 */
library LibClipboard {
    using LibBytes for bytes;

    struct ReturnPasteParams {
        uint80 returnDataItemIndex;
        uint80 copyByteIndex; // first 32 bytes are the length of the return value
        uint80 pasteByteIndex; // first 24 bytes are target + selector (see struct AdvancedPipeCall)
    }

    // Does not include leading 2 bytes of type+userEtherFlag or padding.
    // Encoder v2 does not encodePacked structs. Have to do it manually.
    // returns bytes with length 30
    function encodeReturnPasteParams(
        ReturnPasteParams memory returnPasteParams
    ) internal pure returns (bytes memory) {
        return
            abi.encodePacked(
                returnPasteParams.returnDataItemIndex,
                returnPasteParams.copyByteIndex,
                returnPasteParams.pasteByteIndex
            );
    }

    function decodeReturnPasteParams(
        bytes memory returnPasteParams
    ) internal pure returns (ReturnPasteParams memory) {
        require(returnPasteParams.length == 30, "LibClipboard: invalid returnPasteParams");
        return
            ReturnPasteParams({
                returnDataItemIndex: uint80(returnPasteParams.toUint256(0)),
                copyByteIndex: uint80(returnPasteParams.toUint256(10)),
                pasteByteIndex: uint80(returnPasteParams.toUint256(20))
            });
    }

    function encodeClipboard(ReturnPasteParams memory params) internal pure returns (bytes memory) {
        ReturnPasteParams[] memory returnPasteParams = new ReturnPasteParams[](1);
        returnPasteParams[0] = params;
        return encodeClipboard(0, returnPasteParams);
    }

    /**
     * @notice Encode a clipboard for a single call.
     * @dev Not the most gas efficient. Many small calls to encodePacked.
     * @param etherValue Ether value to send with call.
     * @param returnPasteParams Array of ReturnPasteParams structs to encode into a bytes object.
     * @return clipboard Encoded clipboard, adhering to https://evmpipeline.org/pipeline.pdf, Figure 2.
     */
    function encodeClipboard(
        uint256 etherValue,
        ReturnPasteParams[] memory returnPasteParams
    ) internal pure returns (bytes memory clipboard) {
        // Set clipboard type and use ether flag.
        clipboard = abi.encodePacked(
            returnPasteParams.length < 2
                ? bytes1(uint8(returnPasteParams.length))
                : bytes1(uint8(2)), // type
            etherValue == 0 ? bytes1(0) : bytes1(uint8(1)) // use ether flag
        );

        // Set paste params, with proper padding.
        if (clipboard[1] == bytes1(uint8(1))) {
            clipboard = abi.encodePacked(
                clipboard,
                encodeReturnPasteParams(returnPasteParams[0]),
                etherValue
            );
        } else {
            clipboard = abi.encodePacked(clipboard, bytes30(0), returnPasteParams.length);
            for (uint256 i; i < returnPasteParams.length; ++i) {
                clipboard = abi.encodePacked(
                    clipboard,
                    abi.encodePacked(bytes2(0), encodeReturnPasteParams(returnPasteParams[i]))
                );
            }
        }

        // Optionally append ether value.
        if (clipboard[2] == bytes1(uint8(1))) {
            clipboard = abi.encodePacked(clipboard, etherValue);
        }

        return clipboard;
    }
}
