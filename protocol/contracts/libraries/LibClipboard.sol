/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import {LibBytes} from "./LibBytes.sol";
import {LibTractor} from "./LibTractor.sol";
import {LibFunction} from "./LibFunction.sol";

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

    /** @notice Use a Clipboard on callData to copy return values stored as returnData from any Advanced Calls
     * that have already been executed and paste them into the callData of the next Advanced Call, in a customizable manner
     * @param callData The callData bytes of next Advanced Call to paste onto
     * @param clipboard 0, 1 or n encoded paste operations and encoded ether value if using Pipeline
     * -------------------------------------------------------------------------------------
     * Clipboard stores the bytes:
     * [ Type   | Use Ether Flag*  | Type data      | Ether Value (only if flag == 1)*]
     * [ 1 byte | 1 byte           | n bytes        | 0 or 32 bytes                   ]
     * * Use Ether Flag and Ether Value are processed in Pipeline.sol (Not used in Farm). See Pipeline.getEthValue for ussage.
     * Type: 0x00, 0x01 or 0x002
     *  - 0x00: 0 Paste Operations (Logic in Pipeline.sol and FarmFacet.sol)
     *  - 0x01: 1 Paste Operation
     *  - 0x02: n Paste Operations
     * Type Data: There are two types with type data: 0x01, 0x02
     *  Type 1 (0x01): Copy 1 bytes32 from a previous function return value
     *       [ pasteParams ]
     *       [ 32 bytes ]
     *      Note: Should be encoded with ['bytes2', 'uint80', 'uint80', 'uint80']  where the first two bytes are Type and Send Ether Flag if using Pipeline
     *  Type 2 (0x02): Copy n bytes32 from a previous function return value
     *       [ Padding      | pasteParams[] ]
     *       [ 32 bytes     | 32 + 32 * n   ]
     *        * The first 32 bytes are the length of the array.
     * -------------------------------------------------------------------------------------
     * @param returnData A list of return values from previously executed Advanced Calls
     @return data The function call return datas
    **/
    function useClipboard(
        bytes memory callData,
        bytes memory clipboard,
        bytes[] memory returnData
    ) internal view returns (bytes memory data) {
        bytes1 typeId = clipboard[0];
        if (typeId == 0x01) {
            bytes32 pasteParams = abi.decode(clipboard, (bytes32));
            data = pasteBytes(returnData, callData, pasteParams);
        } else if (typeId == 0x02) {
            (, bytes32[] memory pasteParams) = abi.decode(clipboard, (uint256, bytes32[]));
            data = callData;
            for (uint256 i; i < pasteParams.length; i++)
                data = pasteBytes(returnData, data, pasteParams[i]);
        } else {
            revert("Function: Advanced Type not supported");
        }
    }

    /**
     * @notice Copies 32 bytes from returnData into callData, determined by pasteParams
     * Should be in the following format
     * [2 bytes | 10 bytes               | 10 bytes        | 10 bytes        ]
     * [ N/A    | returnDataItemIndex    | copyByteIndex   | pasteByteIndex  ]
     **/
    function pasteBytes(
        bytes[] memory returnData, // paste source
        bytes memory data, // paste destination
        bytes32 pasteParams // ReturnPasteParams
    ) internal view returns (bytes memory pastedData) {
        // Shift `pasteParams` right 22 bytes to isolate pasteCallIndex.
        // bytes memory pasteCallIndex = pasteParams[]();
        data = LibFunction.paste32Bytes(
            returnData[uint80(bytes10(pasteParams << 16))], // isolate returnDataItemIndex
            data,
            uint256(bytes32(bytes10(pasteParams << 96))), // Isolate copyByteIndex
            uint256(bytes32(bytes10(pasteParams << 176))) // Isolate pasteByteIndex
        );
        // NOTE pass by reference?
    }

    // /**
    //  * @notice Copy 32 Bytes from copyData at copyIndex and paste into pasteData at pasteIndex
    //  * @param copyData The data bytes to copy from
    //  * @param pasteData The data bytes to paste into
    //  * @param copyIndex The index in copyData to copying from
    //  * @param pasteIndex The index in pasteData to paste into
    //  * @param length The length of bytes to copy
    //  * @return pastedData The data with the copied with 32 bytes
    //  **/
    // function pasteBytes(
    //     bytes memory copyData,
    //     bytes memory pasteData,
    //     uint256 copyIndex,
    //     uint256 pasteIndex,
    //     uint256 length
    // ) internal pure returns (bytes memory pastedData) {
    //     uint256 num = length / 32;
    //     for (uint256 i; i != num; ++i) {
    //         assembly {
    //             mstore(add(pasteData, pasteIndex), mload(add(copyData, copyIndex)))
    //         }
    //         pasteIndex += 32;
    //         copyIndex += 32;
    //     }

    //     uint256 diff = length % 32;
    //     for (uint256 i; i != diff; ++i) {
    //         pasteData[pasteIndex + i - 32] = copyData[copyIndex + i - 32];
    //     }

    //     pastedData = pasteData;
    // }
}
