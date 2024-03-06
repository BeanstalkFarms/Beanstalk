import { ethers, BigNumber } from "ethers";

import { BeanstalkSDK } from "../BeanstalkSDK";
import { Clipboard } from "../depot/clipboard";
import { Blueprint, DraftAction, AdvancedFarmCall, OperatorPasteInstr } from "./types";
import { FarmFromMode, FarmToMode } from "src/lib/farm/types";
import { addresses } from "src/constants/addresses";

const SELECTOR_SIZE = BigNumber.from(4);
const SLOT_SIZE = BigNumber.from(32);
const ARGS_START_INDEX = SELECTOR_SIZE.add(SLOT_SIZE);
const ADDR_SLOT_OFFSET = BigNumber.from(12);
const PUBLISHER_COPY_INDEX = BigNumber.from(2).pow(80).sub(1); // uint80.max;
const OPERATOR_COPY_INDEX = PUBLISHER_COPY_INDEX.sub(1); // uint80.max - 1;
const EXTERNAL_ARGS_START_INDEX = SELECTOR_SIZE.mul(2).add(SLOT_SIZE.mul(4)).add(SLOT_SIZE);
const PIPE_RETURN_BYTE_OFFSET = BigNumber.from(64);

export class Drafter {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Drafter.sdk = sdk;
  }

  embedDraft(blueprint: Blueprint, draft: DraftAction[]) {
    let farmCalls: AdvancedFarmCall[] = [];
    let operatorPasteInstrs: OperatorPasteInstr[] = [];
    for (let i = 0; i < draft.length; i++) {
      farmCalls.push(draft[i].farmCall);
      operatorPasteInstrs.concat(draft[i].operatorPasteInstrs);
    }
    blueprint.data = this.encodeBlueprintData(farmCalls);
    blueprint.operatorPasteInstrs = this.encodeOperatorPasteInstrs(operatorPasteInstrs);
  }

  // concatDrafts(firstDraft: Draft, secondDraft: Draft): Draft {
  //   let draft = <Draft>{};
  //   draft.farmCalls = firstDraft.farmCalls.concat(secondDraft.farmCalls);
  //   draft.operatorPasteInstrs = firstDraft.operatorPasteInstrs.concat(
  //     secondDraft.operatorPasteInstrs
  //   );
  //   return draft;
  // }

  // encodeAdvancedFarmCalls
  encodeBlueprintData(calls: AdvancedFarmCall[]): ethers.Bytes {
    // sdk.contracts.farmFacet.interface.encodeFunctionData("advancedFarm", [
    return ethers.utils.arrayify(
      Drafter.sdk.contracts.beanstalk.interface.encodeFunctionData("advancedFarm", [calls])
    );
  }

  // decodeBlueprintData

  encodeOperatorPasteInstrs(instrs: OperatorPasteInstr[]): ethers.Bytes[] {
    return instrs.map((instr) => this.encodeOperatorPasteInstr(instr));
  }

  // Returns Bytes32
  encodeOperatorPasteInstr(instr: OperatorPasteInstr): ethers.Bytes {
    return ethers.utils.concat([
      ethers.utils.zeroPad(ethers.utils.hexValue(instr.copyByteIndex), 10),
      ethers.utils.zeroPad(ethers.utils.hexValue(instr.copyByteIndex), 10),
      ethers.utils.zeroPad(ethers.utils.hexValue(instr.copyByteIndex), 10),
      ethers.utils.zeroPad("", 2) // padding
    ]);
  }

  decodeOperatorPasteInstr(instr: ethers.Bytes): OperatorPasteInstr {
    // const instrBytes: ethers.Bytes = ethers.utils.arrayify(instr);
    if (instr.length != 32) {
      throw TypeError("OperatorPasteInstr must be 32 bytes");
    }
    return {
      copyByteIndex: BigNumber.from(ethers.utils.hexDataSlice(instr, 0, 9)),
      pasteCallIndex: BigNumber.from(ethers.utils.hexDataSlice(instr, 10, 19)),
      pasteByteIndex: BigNumber.from(ethers.utils.hexDataSlice(instr, 20, 29))
    };

    // encodeLibReturnPasteParam(returnDataItemIndex : uint80, copyByteIndex: uint80, pasteByteIndex: uint80): (bytes32) {}
    // decodeLibReturnPasteParam(returnPasteParam : bytes32): (uint80, uint80, uint80) {}
    // encodeClipboard(etherValue : uint256, returnPasteParams: bytes32[]): (Clipboard) {}
    // decodeClipboard(clipboard : Clipboard): (bytes1, uint256, bytes32[]) {}
  }

  balanceOfStalkDraft(callIndex: number): DraftAction {
    return {
      farmCall: {
        callData: Drafter.sdk.contracts.beanstalk.interface.encodeFunctionData("balanceOfStalk", [
          ethers.constants.AddressZero
        ]),
        clipboard: "0x000000"
      },
      operatorPasteInstrs: [
        {
          copyByteIndex: PUBLISHER_COPY_INDEX,
          pasteCallIndex: BigNumber.from(callIndex),
          pasteByteIndex: ARGS_START_INDEX
        }
      ]
    };
  }

  mowDraft(callIndex: number): DraftAction {
    return {
      farmCall: {
        callData: Drafter.sdk.contracts.beanstalk.interface.encodeFunctionData("mow", [
          ethers.constants.AddressZero,
          ethers.constants.AddressZero
        ]),
        clipboard: "0x000000"
      },
      operatorPasteInstrs: [
        {
          copyByteIndex: PUBLISHER_COPY_INDEX,
          pasteCallIndex: BigNumber.from(callIndex),
          pasteByteIndex: ARGS_START_INDEX
        },
        {
          copyByteIndex: PUBLISHER_COPY_INDEX,
          pasteCallIndex: BigNumber.from(callIndex),
          pasteByteIndex: ARGS_START_INDEX.add(SLOT_SIZE)
        }
      ]
    };
  }

  subReturnsDraft(
    leftReturnDataIndex: number,
    rightReturnDataIndex: number,
    leftCopyIndex: number = 0,
    rightCopyIndex: number = 0
  ): DraftAction {
    return {
      farmCall: {
        callData: Drafter.sdk.contracts.junction.interface.encodeFunctionData("sub", [0, 0]),
        clipboard: Clipboard.encode([
          [leftReturnDataIndex, leftCopyIndex, EXTERNAL_ARGS_START_INDEX.toNumber()],
          [
            rightReturnDataIndex,
            rightCopyIndex,
            EXTERNAL_ARGS_START_INDEX.add(SLOT_SIZE).toNumber()
          ]
        ])
      },
      operatorPasteInstrs: []
    };
  }

  scaleReturnDraft(
    returnDataIndex: number,
    mul: BigNumber,
    div: BigNumber,
    copyIndex: number = 0
  ): DraftAction {
    return {
      farmCall: {
        callData: Drafter.sdk.contracts.junction.interface.encodeFunctionData("mulDiv", [
          0,
          mul,
          div
        ]),
        clipboard: Clipboard.encode([
          [returnDataIndex, copyIndex, EXTERNAL_ARGS_START_INDEX.toNumber()]
        ])
      },
      operatorPasteInstrs: []
    };
  }

  transferBeansReturnDraft(returnDataIndex: number, copyIndex: number = 0): DraftAction {
    return {
      farmCall: {
        callData: Drafter.sdk.contracts.beanstalk.interface.encodeFunctionData("transferToken", [
          addresses.BEAN.get(Drafter.sdk.chainId),
          ethers.constants.AddressZero,
          0,
          0, // EXTERNAL
          0 // EXTERNAL
        ]),
        clipboard: Clipboard.encode([
          [returnDataIndex, copyIndex, EXTERNAL_ARGS_START_INDEX.add(SLOT_SIZE.mul(2)).toNumber()]
        ])
      },
      operatorPasteInstrs: []
    };
  }
}
