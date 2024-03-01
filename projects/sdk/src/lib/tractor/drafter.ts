import { ethers } from "ethers";

import { BeanstalkSDK } from "../BeanstalkSDK";
import { Clipboard } from "../depot/clipboard";
import { Blueprint, Requisition, Draft, AdvancedFarmCall, OperatorPasteInstr } from "./types";

const SELECTOR_SIZE = 4;
const SLOT_SIZE = 32;
const ARGS_START_INDEX = SELECTOR_SIZE + SLOT_SIZE;
const ADDR_SLOT_OFFSET = 12;
const PUBLISHER_COPY_INDEX = 2 ** 80 - 1;
const OPERATOR_COPY_INDEX = 2 ** 80 - 2;

export class Drafter {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Drafter.sdk = sdk;
  }

  static embedDraft(blueprint: Blueprint, draft: Draft) {
    blueprint.data = Drafter.encodeBlueprintData(draft.advFarmCalls);
    blueprint.operatorPasteInstrs = Drafter.encodeOperatorPasteInstrs(draft.operatorPasteInstrs);
  }

  static concatDrafts(firstDraft: Draft, secondDraft: Draft): Draft {
    let draft = <Draft>{};
    draft.advFarmCalls = firstDraft.advFarmCalls.concat(secondDraft.advFarmCalls);
    draft.operatorPasteInstrs = firstDraft.operatorPasteInstrs.concat(
      secondDraft.operatorPasteInstrs
    );
    return draft;
  }

  // encodeAdvancedFarmCalls
  static encodeBlueprintData(calls: AdvancedFarmCall[]): ethers.Bytes {
    // sdk.contracts.farmFacet.interface.encodeFunctionData("advancedFarm", [
    return Drafter.sdk.contracts.beanstalk.interface.encodeFunctionData("advancedFarm", [calls]);
  }

  // static decodeBlueprintData

  static encodeOperatorPasteInstrs(instrs: OperatorPasteInstr[]): ethers.Bytes {
    return ethers.utils.concat(instrs.map((instr) => Drafter.encodeOperatorPasteInstr(instr)));
  }

  // Returns Bytes32
  static encodeOperatorPasteInstr(instr: OperatorPasteInstr): ethers.Bytes {
    return ethers.utils.concat([
      ethers.utils.zeroPad(ethers.utils.hexValue(instr.copyByteIndex), 10),
      ethers.utils.zeroPad(ethers.utils.hexValue(instr.copyByteIndex), 10),
      ethers.utils.zeroPad(ethers.utils.hexValue(instr.copyByteIndex), 10),
      ethers.utils.zeroPad("", 2) // padding
    ]);
  }

  static decodeOperatorPasteInstr(instr: ethers.Bytes): OperatorPasteInstr {
    // const instrBytes: ethers.Bytes = ethers.utils.arrayify(instr);
    if (instr.length != 32) {
      throw TypeError("OperatorPasteInstr must be 32 bytes");
    }
    return {
      copyByteIndex: ethers.BigNumber.from(ethers.utils.hexDataSlice(instr, 0, 9)).toNumber(),
      pasteCallIndex: ethers.BigNumber.from(ethers.utils.hexDataSlice(instr, 10, 19)).toNumber(),
      pasteByteIndex: ethers.BigNumber.from(ethers.utils.hexDataSlice(instr, 20, 29)).toNumber()
    };

    // encodeLibReturnPasteParam(returnDataItemIndex : uint80, copyByteIndex: uint80, pasteByteIndex: uint80): (bytes32) {}
    // decodeLibReturnPasteParam(returnPasteParam : bytes32): (uint80, uint80, uint80) {}
    // encodeClipboard(etherValue : uint256, returnPasteParams: bytes32[]): (Clipboard) {}
    // decodeClipboard(clipboard : Clipboard): (bytes1, uint256, bytes32[]) {}
  }

  static balanceOfStalkDraft(callIndex: number): Draft {
    return {
      advFarmCalls: [
        {
          callData: Drafter.sdk.contracts.beanstalk.interface.encodeFunctionData("balanceOfStalk", [
            ethers.constants.AddressZero
          ]),
          clipboard: ethers.utils.arrayify("0x000000")
        }
      ],
      operatorPasteInstrs: [
        {
          copyByteIndex: PUBLISHER_COPY_INDEX,
          pasteCallIndex: callIndex,
          pasteByteIndex: ARGS_START_INDEX
        }
      ]
    };
  }

  static mowDraft(callIndex: number): Draft {
    return {
      advFarmCalls: [
        {
          callData: Drafter.sdk.contracts.beanstalk.interface.encodeFunctionData("mow", [
            ethers.constants.AddressZero,
            ethers.constants.AddressZero
          ]),
          clipboard: ethers.utils.arrayify("0x000000")
        }
      ],
      operatorPasteInstrs: [
        {
          copyByteIndex: PUBLISHER_COPY_INDEX,
          pasteCallIndex: callIndex,
          pasteByteIndex: ARGS_START_INDEX
        },
        {
          copyByteIndex: PUBLISHER_COPY_INDEX,
          pasteCallIndex: callIndex,
          pasteByteIndex: ARGS_START_INDEX + SLOT_SIZE
        }
      ]
    };
  }
}
