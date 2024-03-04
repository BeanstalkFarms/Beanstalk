import { ethers } from "ethers";

export type uint80 = ethers.BigNumber;

export type Blueprint = {
  publisher: string;
  data: ethers.Bytes;
  operatorPasteInstrs: ethers.Bytes;
  maxNonce: ethers.BigNumber;
  startTime: ethers.BigNumber;
  endTime: ethers.BigNumber;
};

export type Requisition = {
  blueprint: Blueprint;
  blueprintHash: string;
  signature: string;
};

// export type Draft = {
//   actions: DraftAction[];
// };

export type DraftAction = {
  farmCall: AdvancedFarmCall;
  operatorPasteInstrs: OperatorPasteInstr[];
};

export type AdvancedFarmCall = {
  callData: ethers.Bytes;
  clipboard: string;
};

export type OperatorPasteInstr = {
  copyByteIndex: uint80;
  pasteCallIndex: uint80;
  pasteByteIndex: uint80;
};
