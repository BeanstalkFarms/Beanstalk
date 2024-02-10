import { BeanstalkSDK } from "../BeanstalkSDK";
import { ethers, ContractTransaction } from "ethers";
import { Requisition, Bytes } from "./types";

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

  async tractor(requisition: Requisition, operatorData: Bytes): Promise<ContractTransaction> {
    return Tractor.sdk.contracts.beanstalk.tractor(requisition, operatorData);
  }

}
