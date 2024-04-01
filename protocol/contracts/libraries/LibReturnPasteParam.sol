/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

import {C} from "contracts/C.sol";
import {LibBytes} from "./LibBytes.sol";

/**
 * @title LibReturnPasteParam
 * @author funderbrker
 * @notice LibReturnPasteParam simplifies interactions with a bytes32 object containing operator paste params.
 * @dev https://evmpipeline.org/pipeline.pdf
 * @dev returnPasteParam are *not* structured the same as operatorPasteInstr.
 * Bytes32 should be in the following format
 * [2 bytes | 10 bytes         | 10 bytes        | 10 bytes        ]
 * [ N/A    | copyReturnIndex  | copyByteIndex   | pasteByteIndex  ]
 */
library LibReturnPasteParam {
    using LibBytes for bytes;

    function encode(
        uint80 _copyReturnIndex,
        uint80 _copyByteIndex,
        uint80 _pasteByteIndex
    ) internal pure returns (bytes32) {
        return
            abi
                .encodePacked(bytes2(0), _copyReturnIndex, _copyByteIndex, _pasteByteIndex)
                .toBytes32(0);
    }

    function decode(bytes32 returnPasteParams) internal pure returns (uint80, uint80, uint80) {
        return (
            copyReturnIndex(returnPasteParams),
            copyByteIndex(returnPasteParams),
            pasteByteIndex(returnPasteParams)
        );
    }

    function copyReturnIndex(bytes32 returnPasteParams) internal pure returns (uint80) {
        return uint80(bytes10(returnPasteParams << 16));
    }

    function copyByteIndex(bytes32 returnPasteParams) internal pure returns (uint80) {
        return uint80(bytes10(returnPasteParams << 96));
    }

    function pasteByteIndex(bytes32 returnPasteParams) internal pure returns (uint80) {
        return uint80(bytes10(returnPasteParams << 176));
    }

    /**
     * @notice Copies 32 bytes from an item in copyFromDataSet into pasteToData, determined by returnPasteParam.
     * @dev    All bytes objects are prepended with length data. Ensure this is accounted for when using byte indices.
     **/
    function pasteBytes(
        bytes32 returnPasteParam, // returnPasteParams
        bytes[] memory copyFromDataSet, // paste source
        bytes memory pasteToData // paste destination.
    ) internal view {
        (uint256 _copyReturnIndex, uint256 _copyByteIndex, uint256 _pasteByteIndex) = decode(
            returnPasteParam
        );
        require(_copyReturnIndex < copyFromDataSet.length, "RP: _copyReturnIndex too large");
        require(C.SLOT_SIZE <= _copyByteIndex, "RP: _copyByteIndex too small");
        require(_copyByteIndex <= copyFromDataSet[_copyReturnIndex].length,"RP: _copyByteIndex too large");
        require(C.SLOT_SIZE <= _pasteByteIndex, "RP: _pasteByteIndex too small");
        require(_pasteByteIndex <= pasteToData.length, "RP: _pasteByteIndex too large");
        LibBytes.paste32Bytes(
            copyFromDataSet[_copyReturnIndex], // isolate copyFromData with _copyReturnIndex
            pasteToData,
            _copyByteIndex, // Isolate copyByteIndex
            _pasteByteIndex // Isolate pasteByteIndex
        );
    }
}
