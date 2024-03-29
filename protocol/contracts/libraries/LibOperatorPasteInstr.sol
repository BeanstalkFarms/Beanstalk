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

    /**
     * @notice  Generates an array of operatorPasteInstr with ascending copy/paste byte indices.
     */
    function generate(
        uint256 length,
        uint80 copyStartByteIndex,
        uint80 _pasteCallIndex,
        uint80 pasteStartByteIndex
    ) internal pure returns (bytes32[] memory) {
        bytes32[] memory operatorPasteInstrs = new bytes32[](length);
        for (uint80 i = 0; i < length; i++) {
            operatorPasteInstrs[i] = encode(
                copyStartByteIndex + C.SLOT_SIZE * i,
                _pasteCallIndex,
                pasteStartByteIndex + C.SLOT_SIZE * i
            );
        }
        return operatorPasteInstrs;
    }

    function copyByteIndex(bytes32 operatorPasteInstr) internal pure returns (uint80) {
        return uint80(bytes10(operatorPasteInstr << 16)); // lil endian
        // return uint80(bytes10(operatorPasteInstr >> 160));
    }

    function pasteCallIndex(bytes32 operatorPasteInstr) internal pure returns (uint80) {
        return uint80(bytes10(operatorPasteInstr << 96)); // lil endian
        // return uint80(bytes10(operatorPasteInstr >> 80));
    }

    function pasteByteIndex(bytes32 operatorPasteInstr) internal pure returns (uint80) {
        return uint80(bytes10(operatorPasteInstr << 176)); // lil endian
        // return uint80(bytes10(operatorPasteInstr));
    }

    /**
     * @notice Copies 32 bytes from operatorData into blueprint data, determined by pasteParams
     * @dev    All bytes objects are prepended with length data. Ensure this is accounted for when entering indices.
     * @param operatorPasteInstr Denotes which data should be copied and where it should be pasted
     * @param operatorData The callData provided by thee operator. Copy from location.
     * @param callData The data from blueprint. Paste to location.
     **/
    function pasteBytes(
        bytes32 operatorPasteInstr,
        bytes memory operatorData,
        bytes memory callData
    ) internal view {
        (uint80 _copyByteIndex, , uint80 _pasteByteIndex) = decode(operatorPasteInstr);

        // _pasteByteIndex must have 32 bytes of available space and not write into the length data.
        require(C.SLOT_SIZE <= _pasteByteIndex, "OP: _pasteByteIndex too small");
        require(_pasteByteIndex <= callData.length, "OP: _pasteByteIndex too large");

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
            copyData = operatorData;
        }
        // _copyByteIndex must have 32 bytes of available space and not write into the length data.
        require(C.SLOT_SIZE <= _copyByteIndex, "OP: _copyByteIndex too small");
        require(_copyByteIndex <= callData.length, "OP: _copyByteIndex too large");

        // data[_pasteCallIndex] = LibBytes.paste32Bytes(
        //     copyData,
        //     data[_pasteCallIndex],
        //     uint256(_copyByteIndex),
        //     _pasteByteIndex
        // );
        LibBytes.paste32Bytes(copyData, callData, uint256(_copyByteIndex), _pasteByteIndex);
    }
}
