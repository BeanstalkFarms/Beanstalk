/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;
pragma experimental ABIEncoderV2;

// TODO rm
import "forge-std/console.sol";

import {C} from "contracts/C.sol";
import {LibBytes} from "./LibBytes.sol";
import {LibFunction} from "./LibFunction.sol";
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
    //  TODO return pastedData the calldata for the next function call with bytes pasted from returnData ?
    function pasteBytes(
        bytes32 operatorPasteInstr,
        bytes memory operatorData,
        bytes memory callData
    ) internal view returns (bytes memory) {
        console.log("HERE-PB-0");
        console.logBytes32(operatorPasteInstr);
        (uint80 _copyByteIndex, , uint80 _pasteByteIndex) = decode(operatorPasteInstr);
        console.log("HERE-PB-1");

        console.log(callData.length);
        console.log(_pasteByteIndex);
        // _pasteByteIndex must have 32 bytes of available space and not write into the length data.
        require(C.SLOT_SIZE <= _pasteByteIndex, "PB: _pasteByteIndex too small");
        require(_pasteByteIndex <= callData.length, "PB: _pasteByteIndex too large");

        console.log(_copyByteIndex);
        bytes memory copyData;
        if (_copyByteIndex == C.PUBLISHER_COPY_INDEX) {
            console.log("HERE-PB-P-0");
            copyData = abi.encodePacked(
                bytes32(bytes20(LibTractor._tractorStorage().activePublisher))
            );
            // Skip length data.
            _copyByteIndex = C.SLOT_SIZE;
            console.log("HERE-PB-P-1");
        } else if (_copyByteIndex == C.OPERATOR_COPY_INDEX) {
            console.log("HERE-PB-O-0");
            copyData = abi.encodePacked(bytes32(bytes20(msg.sender)));
            // Skip length data.
            _copyByteIndex = C.SLOT_SIZE;
        } else {
            console.log("HERE-PB-C-0");
            copyData = operatorData;
        }
        console.log(_copyByteIndex);
        console.logBytes(copyData);
        // _copyByteIndex must have 32 bytes of available space and not write into the length data.
        require(C.SLOT_SIZE <= _copyByteIndex, "PB: _copyByteIndex too small");
        require(_copyByteIndex <= callData.length, "PB: _copyByteIndex too large");

        console.logBytes(callData);
        // data[_pasteCallIndex] = LibFunction.paste32Bytes(
        //     copyData,
        //     data[_pasteCallIndex],
        //     uint256(_copyByteIndex),
        //     _pasteByteIndex
        // );
        LibFunction.paste32Bytes(copyData, callData, uint256(_copyByteIndex), _pasteByteIndex);
        console.logBytes(callData);
        // NOTE is this necessary, or can we rely on pass by reference for internal memory lib functions?
        console.log("HERE-PB-9");
        return callData;
    }
}
