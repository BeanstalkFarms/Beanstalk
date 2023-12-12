/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

// TODO rm
import "forge-std/console.sol";

import {C} from "contracts/C.sol";
import {LibBytes} from "./LibBytes.sol";
import {LibFunction} from "./LibFunction.sol";

// https://evmpipeline.org/pipeline.pdf

/**
 * @title LibReturnPasteParam
 * @author funderbrker
 * @notice LibReturnPasteParam simplifies interactions with a bytes32 object containing operator paste params.
 * @dev returnPasteParam are *not* structured the same as operatorPasteInstr.
 * Bytes32 should be in the following format
 * [2 bytes | 10 bytes         | 10 bytes        | 10 bytes        ]
 * [ N/A    | copyByteIndex    | pasteCallIndex  | pasteByteIndex  ]
 */
library LibReturnPasteParam {
    using LibBytes for bytes;

    function encode(
        uint80 _returnDataItemIndex,
        uint80 _copyByteIndex,
        uint80 _pasteByteIndex
    ) internal pure returns (bytes32) {
        return
            abi
                .encodePacked(bytes2(0), _returnDataItemIndex, _copyByteIndex, _pasteByteIndex)
                .toBytes32(0);
    }

    function decode(bytes32 returnPasteParams) internal pure returns (uint80, uint80, uint80) {
        return (
            returnDataItemIndex(returnPasteParams),
            copyByteIndex(returnPasteParams),
            pasteByteIndex(returnPasteParams)
        );
    }

    function returnDataItemIndex(bytes32 returnPasteParams) internal pure returns (uint80) {
        return uint80(bytes10(returnPasteParams << 16)); // lil endian
    }

    function copyByteIndex(bytes32 returnPasteParams) internal pure returns (uint80) {
        return uint80(bytes10(returnPasteParams << 96)); // lil endian
    }

    function pasteByteIndex(bytes32 returnPasteParams) internal pure returns (uint80) {
        return uint80(bytes10(returnPasteParams << 176)); // lil endian
    }

    /**
     * @notice Copies 32 bytes from returnData into callData, determined by returnPasteParam
     * Should be in the following format
     * [2 bytes | 10 bytes               | 10 bytes        | 10 bytes        ]
     * [ N/A    | returnDataItemIndex    | copyByteIndex   | pasteByteIndex  ]
     **/
    function pasteBytes(
        bytes32 returnPasteParam, // returnPasteParams
        bytes[] memory returnData, // paste source
        bytes memory data // paste destination
    ) internal view returns (bytes memory pastedData) {
        console.log("pasteBytes - clipboard");
        uint256 _returnDataItemIndex = returnDataItemIndex(returnPasteParam);
        uint256 _copyByteIndex = copyByteIndex(returnPasteParam);
        uint256 _pasteByteIndex = pasteByteIndex(returnPasteParam);
        console.log(_returnDataItemIndex);
        console.log(_copyByteIndex);
        console.log(_pasteByteIndex);
        require(C.SLOT_SIZE <= _pasteByteIndex, "PB: _pasteByteIndex too small");
        require(_pasteByteIndex <= data.length, "PB: _pasteByteIndex too large");
        require(C.SLOT_SIZE <= _copyByteIndex, "PB: _copyByteIndex too small");
        require(_copyByteIndex <= data.length, "PB: _copyByteIndex too large");
        require(_returnDataItemIndex < returnData.length, "PB: _returnDataItemIndex too large");
        LibFunction.paste32Bytes(
            returnData[_returnDataItemIndex], // isolate returnDataItemIndex
            data,
            _copyByteIndex, // Isolate copyByteIndex
            _pasteByteIndex // Isolate pasteByteIndex
        );
        // NOTE pass by reference?
        return data;
    }
}
