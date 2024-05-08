//SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {LibClipboard} from "contracts/libraries/LibClipboard.sol";
import {LibBytes} from "contracts/libraries/LibBytes.sol";

contract Drafter {
    function encodeOperatorPasteInstr(
        uint80 _copyByteIndex,
        uint80 _pasteCallIndex,
        uint80 _pasteByteIndex
    ) external pure returns (bytes32) {
        return LibBytes.encode(_copyByteIndex, _pasteCallIndex, _pasteByteIndex);
    }

    function decodeOperatorPasteInstr(
        bytes32 operatorPasteInstr
    ) external pure returns (uint80, uint80, uint80) {
        return LibBytes.decode(operatorPasteInstr);
    }

    function encodeLibReturnPasteParam(
        uint80 _copyReturnIndex,
        uint80 _copyByteIndex,
        uint80 _pasteByteIndex
    ) external pure returns (bytes32) {
        return LibBytes.encode(_copyReturnIndex, _copyByteIndex, _pasteByteIndex);
    }

    function decodeLibReturnPasteParam(
        bytes32 returnPasteParam
    ) external pure returns (uint80, uint80, uint80) {
        return LibBytes.decode(returnPasteParam);
    }

    function encodeClipboard(
        uint256 etherValue,
        bytes32[] memory returnPasteParams
    ) external pure returns (bytes memory clipboard) {
        return LibClipboard.encode(etherValue, returnPasteParams);
    }

    function decodeClipboard(
        bytes memory clipboard
    ) public pure returns (bytes1 typeId, uint256 etherValue, bytes32[] memory returnPasteParams) {
        return LibClipboard.decode(clipboard);
    }
}
