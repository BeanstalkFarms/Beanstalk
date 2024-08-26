import { BigNumber, BigNumberish, ethers } from "ethers";
import { BeanstalkSDK } from "./BeanstalkSDK";
import { TokenValue } from "@beanstalk/sdk-core";
import { ZERO_BN } from "src/constants";

export class Field {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Field.sdk = sdk;
  }

  public async getPlots({
    harvestableIndex: _harvestableIndex,
    account,
    fieldId = "0"
  }: {
    harvestableIndex: BigNumber | TokenValue;
    account: string;
    fieldId: BigNumberish;
  }) {
    const harvestableIndex =
      _harvestableIndex instanceof TokenValue ? _harvestableIndex.toBigNumber() : _harvestableIndex;

    const plots = await Field.sdk.contracts.beanstalk
      .getPlotsFromAccount(account, fieldId)
      .then(
        (p) =>
          new Map<string, BigNumber>(p.map(({ pods, index }) => [index.toString(), pods] as const))
      );

    let pods = ZERO_BN;
    let harvestablePods = ZERO_BN;

    const unharvestablePlots: Map<string, ethers.BigNumber> = new Map();
    const harvestablePlots: Map<string, ethers.BigNumber> = new Map();

    plots.forEach((plot, startIndexStr) => {
      const startIndex = ethers.BigNumber.from(startIndexStr);

      // Fully harvestable
      if (startIndex.add(plot).lte(harvestableIndex)) {
        harvestablePods = harvestablePods.add(plot);
        harvestablePlots.set(startIndexStr, plot);
      }

      // Partially harvestable
      else if (startIndex.lt(harvestableIndex)) {
        const partialAmount = harvestableIndex.sub(startIndex);

        harvestablePods = harvestablePods.add(partialAmount);
        pods = pods.add(plot.sub(partialAmount));

        harvestablePlots.set(startIndexStr, partialAmount);
        unharvestablePlots.set(harvestableIndex.toString(), plot.sub(partialAmount));
      }

      // Unharvestable
      else {
        pods = pods.add(plot);
        unharvestablePlots.set(startIndexStr, plot);
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
