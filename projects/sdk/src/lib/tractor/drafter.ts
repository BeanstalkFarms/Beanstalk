import { BeanstalkSDK } from "../BeanstalkSDK";

import {Clipboard} from '../depot/clipboard'
import {OperatorPasteInstrs} from './OperatorPasteInstrs'

export class Drafter {
    static sdk: BeanstalkSDK;

    clipboard : Clipboard;
    operatorPasteInstrs : OperatorPasteInstrs;
    
    constructor(sdk: BeanstalkSDK) {
      Drafter.sdk = sdk;
    }

    // operatorPasteInstrs.encode()
    // encodeOperatorPasteInstr(copyByteIndex : uint80, pasteCallIndex: uint80, pasteByteIndex: uint80): bytes32 {}
    // operatorPasteInstrs.decode()
    // decodeOperatorPasteInstr(operatorPasteInstr : bytes32): (uint80, uint80, uint80) {}

    // clipboard.pack()
    // encodeLibReturnPasteParam(returnDataItemIndex : uint80, copyByteIndex: uint80, pasteByteIndex: uint80): (bytes32) {}
    // clipboard.unpack()
    // decodeLibReturnPasteParam(returnPasteParam : bytes32): (uint80, uint80, uint80) {}
    // clipboard.encode()
    // encodeClipboard(etherValue : uint256, returnPasteParams: bytes32[]): (Clipboard) {}
    // clipboard.decode()
    // decodeClipboard(clipboard : Clipboard): (bytes1, uint256, bytes32[]) {}

  }
