/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity =0.7.6;

// TODO rm
import "forge-std/console.sol";

import {LibBytes} from "./LibBytes.sol";
import {LibFunction} from "./LibFunction.sol";
import {LibTractor} from "./LibTractor.sol";

uint80 constant PUBLISHER_COPY_INDEX = type(uint80).max;
uint80 constant OPERATOR_COPY_INDEX = type(uint80).max - 1;
uint80 constant SLOT_SIZE = 32;

/**
 * @title LibOperatorPasteParams
 * @author funderbrker
 * @notice LibOperatorPasteParams simplifies interactions with a bytes32 object containing operator paste params.
 * @dev OperatorPasteParams are *not* structured the same as clipboard pasteParams.
 * Bytes32 should be in the following format
 * [2 bytes | 10 bytes         | 10 bytes        | 10 bytes        ]
 * [ N/A    | copyByteIndex    | pasteCallIndex  | pasteByteIndex  ]
 */
library LibOperatorPasteParams {
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

    function decode(bytes32 operatorPasteParams) internal pure returns (uint80, uint80, uint80) {
        return (
            copyByteIndex(operatorPasteParams),
            pasteCallIndex(operatorPasteParams),
            pasteByteIndex(operatorPasteParams)
        );
    }

    function generate(
        uint256 length,
        uint80 copyStartByteIndex,
        uint80 _pasteCallIndex,
        uint80 pasteStartByteIndex
    ) internal pure returns (bytes memory) {
        bytes memory operatorPasteParams;
        for (uint80 i = 0; i < length; i++) {
            operatorPasteParams = operatorPasteParams.append(
                encode(
                    copyStartByteIndex + SLOT_SIZE * i,
                    _pasteCallIndex,
                    pasteStartByteIndex + SLOT_SIZE * i
                )
            );
        }
        return operatorPasteParams;
    }

    function copyByteIndex(bytes32 operatorPasteParams) internal pure returns (uint80) {
        return uint80(bytes10(operatorPasteParams << 16)); // lil endian
        // return uint80(bytes10(operatorPasteParams >> 160));
    }

    function pasteCallIndex(bytes32 operatorPasteParams) internal pure returns (uint80) {
        return uint80(bytes10(operatorPasteParams << 96)); // lil endian
        // return uint80(bytes10(operatorPasteParams >> 80));
    }

    function pasteByteIndex(bytes32 operatorPasteParams) internal pure returns (uint80) {
        return uint80(bytes10(operatorPasteParams << 176)); // lil endian
        // return uint80(bytes10(operatorPasteParams));
    }

    /**
     * @notice Copies 32 bytes from operatorCallData into blueprint data, determined by pasteParams
     * @param operatorPasteParams Denotes which data should be copied and where it should be pasted
     * @param operatorData The callData provided by thee operator. Copy from location.
     * @param data The data from blueprint. Paste to location.
     **/
    //  TODO return pastedData the calldata for the next function call with bytes pasted from returnData ?
    function pasteBytes(
        bytes32 operatorPasteParams,
        bytes memory operatorData,
        bytes[] memory data
    ) internal view returns (bytes[] memory) {
        console.log("HERE-PB-0");
        console.logBytes32(operatorPasteParams);
        (uint80 _copyByteIndex, uint80 _pasteCallIndex, uint80 _pasteByteIndex) = decode(
            operatorPasteParams
        );
        console.log("HERE-PB-1");

        console.log(data.length);
        console.log(_pasteCallIndex);
        require(data.length > _pasteCallIndex, "PB: pasteCallIndex out of bounds");
        console.logBytes(data[_pasteCallIndex]);
        console.log(_pasteByteIndex);
        require(
            data[_pasteCallIndex].length >= _pasteByteIndex + 32,
            "PB: _pasteByteIndex out of bounds"
        );

        bytes memory copyData;
        if (_copyByteIndex == PUBLISHER_COPY_INDEX) {
            console.log("HERE-PB-P-0");
            copyData = abi.encodePacked(
                bytes32(bytes20(LibTractor._tractorStorage().activePublisher))
            );
            _copyByteIndex = 0;
            console.log("HERE-PB-P-1");
        } else if (_copyByteIndex == OPERATOR_COPY_INDEX) {
            console.log("HERE-PB-O-0");
            copyData = abi.encodePacked(bytes32(bytes20(msg.sender)));
            _copyByteIndex = 0;
        } else {
            console.log("HERE-PB-C-0");
            copyData = operatorData;
        }
        console.log(_copyByteIndex);
        console.logBytes(copyData);
        require(copyData.length >= _copyByteIndex + 32, "PB: copyByteIndex out of bounds");

        console.logBytes(data[0]);
        data[_pasteCallIndex] = LibFunction.paste32Bytes(
            copyData,
            data[_pasteCallIndex],
            uint256(_copyByteIndex),
            _pasteByteIndex
        );
        // NOTE is this necessary, or can we rely on pass by reference for internal memory lib functions?
        console.log("HERE-PB-9");
        return data;
    }
}
