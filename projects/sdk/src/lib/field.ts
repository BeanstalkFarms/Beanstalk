import { BigNumberish } from "ethers";
import { BeanstalkSDK } from "./BeanstalkSDK";
import { TokenValue } from "@beanstalk/sdk-core";

export class Field {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Field.sdk = sdk;
  }

  public async getPlots(account: string, _fieldId: BigNumberish = "0") {
    const plots = await Field.sdk.contracts.beanstalk.getPlotsFromAccount(account, _fieldId);

    const plotMap = plots.reduce<Record<string, TokenValue>>((prev, curr) => {
      const index = Field.sdk.tokens.PODS.fromBlockchain(curr.index);
      const pods = Field.sdk.tokens.PODS.fromBlockchain(curr.pods);

      prev[index.toHuman()] = pods;
      return prev;
    }, {});

    return plotMap;
  }
}
