/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import {LibTractor} from "./LibTractor.sol";

// https://evmpipeline.org/pipeline.pdf, Figure 2
library LibClipboard {
    using LibBytes for bytes;

    struct ReturnPasteParams {
        uint80 returnDataItemIndex;
        bytes10 copyByteIndex; // first 32 bytes are the length of the return value
        bytes10 pasteByteIndex; // first 24 bytes are target + selector (see struct AdvancedPipeCall)
    }

    // Does not include leading 2 bytes of type+userEtherFlag or padding.
    // Encoder v2 does not encodePacked structs. Have to do it manually.
    // returns bytes with length 30
    function encodeReturnPasteParams(
        ReturnPasteParams memory returnPasteParams
    ) internal pure returns (bytes) {
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
                copyByteIndex: bytes10(returnPasteParams.toUint256(10)),
                pasteByteIndex: bytes10(returnPasteParams.toUint256(20))
            });
    }

    function encodeClipboard(
        ReturnPasteParams memory returnPasteParams
    ) internal pure returns (bytes memory) {
        ReturnPasteParams[] memory returnPasteParams = new ReturnPasteParams[](1);
        returnPasteParams[0] = returnPasteParams;
        return encodeClipboard(0, returnPasteParams);
    }

    function encodeClipboard(
        uint256 etherValue,
        ReturnPasteParams[] memory returnPasteParams
    ) internal pure returns (bytes memory) {
        // NOTE probably not the most gas efficient. Many small calls to encodePacked.

        // Set clipboard type and use ether flag.
        bytes clipboard = abi.encodePacked(
            returnPasteParams.length < 2 ? bytes1(returnPasteParams.length) : bytes1(2), // type
            ethValue == 0 ? bytes1(0) : bytes1(1) // use ether flag
        );

        // Set paste params, with proper padding.
        if (clipboard[1] == 1) {
            clipboard = abi.encodePacked(
                clipboard,
                encodeReturnPasteParams(returnPasteParams[0]),
                etherValue
            );
        } else {
            clipboard = abi.encodePacked(clipboard, bytes30(0), returnPasteParams.length);
            for (uint256 i; i < returnPasteParams.length; ++i) {
                clipboard.append(
                    abi.encodePacked(bytes2(0), encodeReturnPasteParams(returnPasteParams[i]))
                );
            }
        }

        // Optionally append ether value.
        if (clipboard[2] == 1) {
            clipboard = abi.encodePacked(clipboard, etherValue);
        }

        return clipboard;
    }
}
