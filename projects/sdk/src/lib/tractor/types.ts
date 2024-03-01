import { ethers } from "ethers";

export type uint80 = number;

export type Blueprint = {
  publisher: string;
  data: ethers.Bytes;
  operatorPasteInstrs?: ethers.Bytes;
  maxNonce: ethers.BigNumber;
  startTime: ethers.BigNumber;
  endTime: ethers.BigNumber;
};

export type Requisition = {
  blueprint: Blueprint;
  blueprintHash: ethers.Bytes;
  signature: ethers.Bytes;
};

export type Draft = {
  advFarmCalls: AdvancedFarmCall[];
  operatorPasteInstrs: OperatorPasteInstr[];
};

export type AdvancedFarmCall = {
  callData: ethers.Bytes;
  clipboard: ethers.Bytes;
};

export type OperatorPasteInstr = {
  copyByteIndex: uint80;
  pasteCallIndex: uint80;
  pasteByteIndex: uint80;
};
