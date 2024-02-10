import { BeanstalkSDK } from "../BeanstalkSDK";
import { uint80, Bytes32 } from "./types";

export class OperatorPasteInstrs {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    OperatorPasteInstrs.sdk = sdk;
  }

  encode(copyByteIndex: uint80, pasteCallIndex: uint80, pasteByteIndex: uint80): Bytes32 { return ''; }

  decode(operatorPasteInstr: Bytes32): [uint80, uint80, uint80] { return ['', '', ''] }


}
