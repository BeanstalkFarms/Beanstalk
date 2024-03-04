import { BeanstalkSDK } from "../BeanstalkSDK";
import { ethers, ContractTransaction } from "ethers";
import { Blueprint, Requisition } from "./types";

export class Tractor {
  static sdk: BeanstalkSDK;
  //   publisher: Publisher;
  //   sequenceBuilder: BlueprintBuilder;
  //   operator: Operator;
  //   sequenceBuilder: OperatorDataBuilder;

  constructor(sdk: BeanstalkSDK) {
    Tractor.sdk = sdk;
    // this.sequenceBuilder = new SequenceBuilder(sdk);
    // this.operator = new Operator(sdk);
    // this.publisher = new Publisher(sdk);
  }

  static async getBlueprintHash(blueprint: Blueprint): Promise<string> {
    return Tractor.sdk.contracts.beanstalk.getBlueprintHash(blueprint);
  }

  // async signRequisition(requisition: Requisition, signer: ethers.Signer) {
  //   // Ethers treats hash as an unexpectedly encoded string, whereas solidity signs hash as bytes. So arrayify here.
  //   requisition.signature = await signer.signMessage(
  //     ethers.utils.arrayify(requisition.blueprintHash)
  //   );
  // }

  // async composeBlueprintData() {}

  // async composeBlueprintOperatorPasteInstrs() {}

  // async encodeData() {}

  // encode;

  // async encodeOperatorData() {}

  async tractor(
    requisition: Requisition,
    operatorData: ethers.Bytes
  ): Promise<ContractTransaction> {
    return Tractor.sdk.contracts.beanstalk.tractor(requisition, operatorData);
  }
}
