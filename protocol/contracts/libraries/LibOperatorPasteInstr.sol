/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

import {C} from "contracts/C.sol";
import {LibBytes} from "./LibBytes.sol";
import {LibTractor} from "./LibTractor.sol";

/**
 * @title LibOperatorPasteInstr
 * @author funderbrker
 * @notice LibOperatorPasteInstr simplifies interactions with a bytes32 object containing operator paste params.
 * @dev OperatorPasteInstr are *not* structured the same as clipboard pasteParams.
 * Bytes32 should be in the following format
 * [2 bytes | 10 bytes         | 10 bytes        | 10 bytes        ]
 * [ N/A    | copyByteIndex    | pasteCallIndex  | pasteByteIndex  ]
 */
library LibOperatorPasteInstr {
    using LibBytes for bytes;

    function encode(
        uint80 _copyByteIndex,
        uint80 _pasteCallIndex,
        uint80 _pasteByteIndex
    ) internal pure returns (bytes32) {
        return
            abi
                .encodePacked(bytes2(""), _copyByteIndex, _pasteCallIndex, _pasteByteIndex)
                .toBytes32(0);
    }

    function decode(bytes32 operatorPasteInstr) internal pure returns (uint80, uint80, uint80) {
        return (
            copyByteIndex(operatorPasteInstr),
            pasteCallIndex(operatorPasteInstr),
            pasteByteIndex(operatorPasteInstr)
        );
    }

    function copyByteIndex(bytes32 operatorPasteInstr) internal pure returns (uint80) {
        return uint80(bytes10(operatorPasteInstr << 16));
    }

    function pasteCallIndex(bytes32 operatorPasteInstr) internal pure returns (uint80) {
        return uint80(bytes10(operatorPasteInstr << 96));
    }

    function pasteByteIndex(bytes32 operatorPasteInstr) internal pure returns (uint80) {
        return uint80(bytes10(operatorPasteInstr << 176));
    }

    /**
     * @notice Copies 32 bytes from copyFromData into pasteToData, determined by pasteParams
     * @dev    All bytes objects are prepended with length data. Ensure this is accounted for when using byte indices.
     * @param operatorPasteInstr Denotes which data should be copied and where it should be pasted
     * @param copyFromData The data to copy from. Data provided by the operator.
     * @param pasteToData The data to paste into. Calldata of the tractor operation.
     **/
    function pasteBytes(
        bytes32 operatorPasteInstr,
        bytes memory copyFromData,
        bytes memory pasteToData
    ) internal view {
        (uint80 _copyByteIndex, , uint80 _pasteByteIndex) = decode(operatorPasteInstr);

        bytes memory copyData;
        if (_copyByteIndex == C.PUBLISHER_COPY_INDEX) {
            copyData = abi.encodePacked(
                uint256(uint160(LibTractor._tractorStorage().activePublisher))
            );
            // Skip length data.
            _copyByteIndex = C.SLOT_SIZE;
        } else if (_copyByteIndex == C.OPERATOR_COPY_INDEX) {
            copyData = abi.encodePacked(uint256(uint160(msg.sender)));
            // Skip length data.
            _copyByteIndex = C.SLOT_SIZE;
        } else {
            copyData = copyFromData;
        }
        // _copyByteIndex must have 32 bytes of available space and not write into the length data.
        // The 32 byte copy/paste size cancels out the array length slot.
        require(C.SLOT_SIZE <= _copyByteIndex, "OP: _copyByteIndex too small");
        require(_copyByteIndex <= copyData.length, "OP: _copyByteIndex too large");

        // _pasteByteIndex must have 32 bytes of available space and not write into the length data.
        // The 32 byte copy/paste size cancels out the array length slot.
        require(C.SLOT_SIZE <= _pasteByteIndex, "OP: _pasteByteIndex too small");
        require(_pasteByteIndex <= pasteToData.length, "OP: _pasteByteIndex too large");

        LibBytes.paste32Bytes(copyData, pasteToData, _copyByteIndex, _pasteByteIndex);
    }
}
