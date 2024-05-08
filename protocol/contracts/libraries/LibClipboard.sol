/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {LibBytes} from "./LibBytes.sol";
import {LibTractor} from "./LibTractor.sol";
import {LibFunction} from "./LibFunction.sol";

/**
 * @title LibClipboard
 * @author funderbrker
 * @notice LibClipboard offers utility functions for managing Pipeline clipboards.
 */
library LibClipboard {
    using LibBytes for bytes;

    /**
     * @notice Encode a clipboard for a set of calls. Automatically determines type and useEther flag.
     * @dev Not the most gas efficient. Many small calls to encodePacked.
     * @param etherValue Ether value to send with call. If 0, useEther flag is set to 0.
     * @param returnPasteParams Array of returnPasteParam encoded as bytes32 objects.
     * @return clipboard Encoded clipboard, adhering to https://evmpipeline.org/pipeline.pdf, Figure 2.
     */
    function encode(
        uint256 etherValue,
        bytes32[] memory returnPasteParams
    ) internal pure returns (bytes memory clipboard) {
        uint8 useEther = etherValue == 0 ? 0 : 1;

        if (returnPasteParams.length == 0) {
            clipboard = abi.encodePacked(uint8(0), useEther);
        } else if (returnPasteParams.length == 1) {
            clipboard = abi.encodePacked(
                uint8(1),
                useEther,
                uint240(uint256(returnPasteParams[0])) // remove padding
            );
        } else {
            clipboard = abi.encode(
                (uint256(0x02) << 248) | (uint256(useEther) << 240), // type + ether
                returnPasteParams
            );
        }

        if (useEther == 1) {
            clipboard = abi.encodePacked(clipboard, etherValue);
        }

        return clipboard;
    }

    function decode(
        bytes memory clipboard
    )
        internal
        pure
        returns (bytes1 typeId, uint256 etherValue, bytes32[] memory returnPasteParams)
    {
        typeId = clipboard[0];
        if (typeId == 0x01) {
            returnPasteParams = new bytes32[](1);
            returnPasteParams[0] = abi.decode(clipboard, (bytes32));
        } else if (typeId == 0x02) {
            (, returnPasteParams) = abi.decode(clipboard, (bytes2, bytes32[]));
        }

        bytes1 useEther = clipboard[1];
        if (useEther == 0x01) {
            etherValue = clipboard.toUint256(clipboard.length - 32);
        }
    }

    /** @notice Use a Clipboard on callData to copy return values stored as returnData from any Advanced Calls
     * that have already been executed and paste them into the callData of the next Advanced Call, in a customizable manner
     * https://evmpipeline.org/pipeline.pdf, Figure 2
     * @param callData The callData bytes of next Advanced Call to paste onto
     * @param clipboard 0, 1 or n encoded paste operations and encoded ether value if using Pipeline
     * -------------------------------------------------------------------------------------
     * Clipboard stores the bytes:
     * [ Type   | Use Ether Flag*  | Type data      | Ether Value (only if flag == 1)*]
     * [ 1 byte | 1 byte           | n bytes        | 0 or 32 bytes                   ]
     * * Use Ether Flag and Ether Value are processed in Pipeline.sol (Not used in Farm). See Pipeline.getEthValue for ussage.
     * Type: 0x00, 0x01 or 0x02
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
     *       [ 64 bytes     | 32 + 32 * n   ]
     *        * The first 32 bytes are the location of data, the next 32 bytes are the length of the array.
     * -------------------------------------------------------------------------------------
     * @param returnData A list of return values from previously executed Advanced Calls
     * @return data The function call return datas
     **/
    function useClipboard(
        bytes memory callData,
        bytes memory clipboard,
        bytes[] memory returnData
    ) internal pure returns (bytes memory data) {
        (bytes1 typeId, , bytes32[] memory returnPasteParams) = decode(clipboard);
        require(typeId == 0x01 || typeId == 0x02, "Clipboard: Type not supported");
        data = callData;
        for (uint256 i; i < returnPasteParams.length; i++) {
            LibBytes.pasteBytesClipboard(returnPasteParams[i], returnData, data);
        }
    }
}
