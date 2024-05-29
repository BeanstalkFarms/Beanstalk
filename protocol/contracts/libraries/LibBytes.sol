/**
 * SPDX-License-Identifier: MIT
 **/

pragma solidity ^0.8.20;

import {C} from "contracts/C.sol";
import {LibTractor} from "./LibTractor.sol";

/**
 * @title LibBytes
 * @notice LibBytes offers utility functions for managing data at the Byte level.
 */
library LibBytes {
    /*
     * @notice From Solidity Bytes Arrays Utils
     * @author Gonçalo Sá <goncalo.sa@consensys.net>
     */
    function toUint8(bytes memory _bytes, uint256 _start) internal pure returns (uint8) {
        require(_start + 1 >= _start, "toUint8_overflow");
        require(_bytes.length >= _start + 1, "toUint8_outOfBounds");
        uint8 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x1), _start))
        }

        return tempUint;
    }

    /*
     * @notice From Solidity Bytes Arrays Utils
     * @author Gonçalo Sá <goncalo.sa@consensys.net>
     */
    function toUint32(bytes memory _bytes, uint256 _start) internal pure returns (uint32) {
        require(_start + 4 >= _start, "toUint32_overflow");
        require(_bytes.length >= _start + 4, "toUint32_outOfBounds");
        uint32 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x4), _start))
        }

        return tempUint;
    }

    function toUint80(bytes memory _bytes, uint256 _start) internal pure returns (uint80) {
        require(_start + 10 >= _start, "toUint32_overflow");
        require(_bytes.length >= _start + 10, "toUint32_outOfBounds");
        uint80 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0xA), _start))
        }

        return tempUint;
    }

    /*
     * @notice From Solidity Bytes Arrays Utils
     * @author Gonçalo Sá <goncalo.sa@consensys.net>
     */
    function toUint256(bytes memory _bytes, uint256 _start) internal pure returns (uint256) {
        require(_start + 32 >= _start, "toUint256_overflow");
        require(_bytes.length >= _start + 32, "toUint256_outOfBounds");
        uint256 tempUint;

        assembly {
            tempUint := mload(add(add(_bytes, 0x20), _start))
        }

        return tempUint;
    }

    function toBytes32(bytes memory _bytes, uint256 _start) internal pure returns (bytes32) {
        require(_start + 32 >= _start, "toBytes32_overflow");
        require(_bytes.length >= _start + 32, "toBytes32_outOfBounds");
        bytes32 tempBytes32;

        assembly {
            tempBytes32 := mload(add(add(_bytes, 0x20), _start))
        }

        return tempBytes32;
    }

    /**
     * @notice slices bytes memory
     * @param b The memory bytes array to load from
     * @param start The start of the slice
     * @return sliced bytes
     */
    function sliceFrom(bytes memory b, uint256 start) internal pure returns (bytes memory) {
        uint256 length = b.length - start;
        bytes memory memBytes = new bytes(length);
        for (uint256 i = 0; i < length; ++i) {
            memBytes[i] = b[start + i];
        }
        return memBytes;
    }

    /**
     * @notice Loads a slice of a calldata bytes array into memory
     * @param b The calldata bytes array to load from
     * @param start The start of the slice
     * @param length The length of the slice
     */
    function sliceToMemory(
        bytes calldata b,
        uint256 start,
        uint256 length
    ) internal pure returns (bytes memory) {
        bytes memory memBytes = new bytes(length);
        for (uint256 i = 0; i < length; ++i) {
            memBytes[i] = b[start + i];
        }
        return memBytes;
    }

    /**
     * @notice Copy 32 Bytes from copyFromData at copyIndex and paste into pasteToData at pasteIndex
     * @param copyFromData The data bytes to copy from
     * @param pasteToData The data bytes to paste into
     * @param copyIndex The index in copyFromData to copying from
     * @param pasteIndex The index in pasteToData to paste into
     **/
    function paste32Bytes(
        bytes memory copyFromData,
        bytes memory pasteToData,
        uint256 copyIndex,
        uint256 pasteIndex
    ) internal pure {
        assembly {
            mstore(add(pasteToData, pasteIndex), mload(add(copyFromData, copyIndex)))
        }
    }

    ///////// DEPOSIT ID /////////

    function packAddressAndStem(address _address, int96 stem) internal pure returns (uint256) {
        return (uint256(uint160(_address)) << 96) | uint96(stem);
    }

    function unpackAddressAndStem(uint256 data) internal pure returns (address, int96) {
        return (address(uint160(data >> 96)), int96(int256(data)));
    }

    /////// CLIPBOARD ///////

    /**
     * @notice Paste bytes using clipboard parameters.
     * @dev Reverts if `getCopyReturnIndex` returns an
     * invalid index (i.e < `copyFromDataSet.length`)
     */
    function pasteBytesClipboard(
        bytes32 returnPasteParam, // Copy/paste instructions.
        bytes[] memory copyFromDataSet, // data to copy from.
        bytes memory pasteToData // Paste destination.
    ) internal pure {
        (uint256 copyReturnIndex, uint256 copyByteIndex, uint256 pasteByteIndex) = decode(
            returnPasteParam
        );
        bytes memory copyFromData = copyFromDataSet[copyReturnIndex];

        // Verify that the copyFromData and pasteToData are valid.
        verifyCopyByteIndex(copyByteIndex, copyFromData);
        verifyPasteByteIndex(pasteByteIndex, pasteToData);

        // Copy 32 bytes from copyFromData at copyByteIndex and
        // paste into pasteToData at pasteByteIndex.
        paste32Bytes(copyFromData, pasteToData, copyByteIndex, pasteByteIndex);
    }

    /////// TRACTOR ///////

    /**
     * @notice Paste bytes using tractor parameters.
     */
    function pasteBytesTractor(
        bytes32 operatorPasteInstr,
        bytes memory copyFromData,
        bytes memory pasteToData
    ) internal view {
        // Decode operatorPasteInstr.
        (uint80 copyByteIndex, , uint80 pasteByteIndex) = decode(operatorPasteInstr);

        // if copyByteIndex matches the publisher or operator index,
        // replace data with the publisher/operator address.
        if (copyByteIndex == C.PUBLISHER_COPY_INDEX) {
            copyFromData = abi.encodePacked(
                uint256(uint160(address(LibTractor._tractorStorage().activePublisher)))
            );
            copyByteIndex = C.SLOT_SIZE;
        } else if (copyByteIndex == C.OPERATOR_COPY_INDEX) {
            copyFromData = abi.encodePacked(uint256(uint160(msg.sender)));
            copyByteIndex = C.SLOT_SIZE;
        }

        // Verify that the copyFromData and pasteToData are valid.
        verifyCopyByteIndex(copyByteIndex, copyFromData);
        verifyPasteByteIndex(pasteByteIndex, pasteToData);

        // Copy 32 bytes from copyFromData at copyByteIndex and
        // paste into pasteToData at pasteByteIndex.
        paste32Bytes(copyFromData, pasteToData, copyByteIndex, pasteByteIndex);
    }

    /////// BYTES32 ENCODED INDICES ///////

    /**
     * @notice Verifies that the byte index of the copy data is within bounds.
     */
    function verifyCopyByteIndex(uint256 copyByteIndex, bytes memory copyFromData) internal pure {
        require(C.SLOT_SIZE <= copyByteIndex, "LibBytes: copyByteIndex too small");
        require(copyByteIndex <= copyFromData.length, "LibBytes: copyByteIndex too large");
    }

    /**
     * @notice Verifies that the paste index of the copy data is within bounds.
     */
    function verifyPasteByteIndex(uint256 pasteByteIndex, bytes memory pasteToData) internal pure {
        require(C.SLOT_SIZE <= pasteByteIndex, "LibBytes: pasteByteIndex too small");
        require(pasteByteIndex <= pasteToData.length, "LibBytes: pasteByteIndex too large");
    }

    /**
     * @notice Encodes an tractor blueprint operator paste or
     * a clipboard paste param instruction.
     */
    function encode(
        uint80 _index0,
        uint80 _index1,
        uint80 _index2
    ) internal pure returns (bytes32) {
        return toBytes32(abi.encodePacked(bytes2(0), _index0, _index1, _index2), 0);
    }

    /**
     * @notice Decodes a copyPasteInstruction into the
     * copy return index, copy byte index, and paste byte index.
     */
    function decode(bytes32 indices) internal pure returns (uint80, uint80, uint80) {
        return (getIndex0(indices), getIndex1(indices), getIndex2(indices));
    }

    /**
     * @notice Returns the index at position 0 in a bytes32 encoded set of indices. Either the copy return index or the paste call index.
     * @dev Used in `pasteBytesClipboard` to choose which return parameter to copy from.
     */
    function getIndex0(bytes32 indices) internal pure returns (uint80) {
        return uint80(bytes10(indices << 16));
    }

    /**
     * @notice Returns the index at position 1 in a bytes32 encoded set of indices. The copy byte index.
     * @dev Used to determine what byte index to start copying 32 bytes from.
     */
    function getIndex1(bytes32 indices) internal pure returns (uint80) {
        return uint80(bytes10(indices << 96));
    }

    /**
     * @notice Returns the index at position 2 in a bytes32 encoded set of indices. The paste byte index.
     * @dev Used to determine what byte index to paste in data at.
     */
    function getIndex2(bytes32 indices) internal pure returns (uint80) {
        return uint80(bytes10(indices << 176));
    }
}
