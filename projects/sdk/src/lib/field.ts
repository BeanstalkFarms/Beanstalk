import { BigNumber, BigNumberish, ethers } from "ethers";
import { BeanstalkSDK } from "./BeanstalkSDK";
import { TokenValue } from "@beanstalk/sdk-core";

export class Field {
  private static DEFAULT_FIELD_ID = "0";

  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Field.sdk = sdk;
  }

  public async getHarvestableIndex(fieldId: BigNumberish = Field.DEFAULT_FIELD_ID) {
    return Field.sdk.contracts.beanstalk.harvestableIndex(fieldId);
  }

  public async getPlotsFromAccount(
    account: string,
    fieldId: BigNumberish = Field.DEFAULT_FIELD_ID
  ) {
    const plots = await Field.sdk.contracts.beanstalk.getPlotsFromAccount(account, fieldId);

    return new Map<string, BigNumber>(
      plots.map(({ pods, index }) => [index.toString(), pods] as const)
    );
  }

  public async getParsedPlotsFromAccount(account: string, fieldId: BigNumberish) {
    const [plots, harvestableIndex] = await Promise.all([
      this.getPlotsFromAccount(account, fieldId),
      this.getHarvestableIndex(fieldId)
    ]);

    const PODS = Field.sdk.tokens.PODS;

    let pods = PODS.fromHuman("0");
    let harvestablePods = PODS.fromHuman("0");

    const unharvestablePlots: Map<string, TokenValue> = new Map();
    const harvestablePlots: Map<string, TokenValue> = new Map();

    plots.forEach((plot, startIndexStr) => {
      const startIndex = ethers.BigNumber.from(startIndexStr);

      // Fully harvestable
      if (startIndex.add(plot).lte(harvestableIndex)) {
        harvestablePods = harvestablePods.add(plot);
        harvestablePlots.set(startIndexStr, PODS.fromBlockchain(plot));
      }

      // Partially harvestable
      else if (startIndex.lt(harvestableIndex)) {
        const partialAmount = harvestableIndex.sub(startIndex);

        harvestablePods = harvestablePods.add(partialAmount);
        pods = pods.add(plot.sub(partialAmount));

        harvestablePlots.set(startIndexStr, PODS.fromBlockchain(partialAmount));
        unharvestablePlots.set(
          harvestableIndex.toString(),
          PODS.fromBlockchain(plot.sub(partialAmount))
        );
      }

      // Unharvestable
      else {
        pods = pods.add(plot);
        unharvestablePlots.set(startIndexStr, PODS.fromBlockchain(plot));
      }
    });

    // FIXME: "unharvestable pods" are just Pods,
    // but we can't reuse "plots" in the same way.
    return {
      pods,
      harvestablePods,
      plots: unharvestablePlots,
      harvestablePlots
    };
  }
}
