import { ethers } from "ethers";
import { Token } from "src/classes/Token";
import {
  SowEvent,
  HarvestEvent,
  PlotTransferEvent,
  AddDepositEvent,
  RemoveDepositEvent,
  RemoveDepositsEvent
} from "src/constants/generated/protocol/abi/Beanstalk";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { EventManager } from "src/lib/events/EventManager";
import { ZERO_BN } from "src/constants";

// ----------------------------------------

const SupportedEvents = [
  // Field
  "Sow",
  "Harvest",
  "PlotTransfer",

  // Silo
  "AddDeposit",
  "RemoveDeposit",
  "RemoveDeposits"
] as const;
const SupportedEventsSet = new Set(SupportedEvents);

// ----------------------------------------

// TODO: commeting these out for now, tbd if they're needed.
// export const BN = (v: ethers.BigNumber | BigNumber.Value) => (v instanceof ethers.BigNumber ? new BigNumber(v.toString()) : new BigNumber(v));
// export const decimalBN = (v: ethers.BigNumber | BigNumber.Value, decimals: number) => BN(v).div(10 ** decimals);
// export const tokenBN = (v: ethers.BigNumber | BigNumber.Value, token: Token) => decimalBN(v, token.decimals);

export const setToMap = (tokens: Set<Token>): Map<Token, any> => {
  const map = new Map<Token, any>();
  for (const token of tokens) {
    map.set(token, {});
  }
  return map;
};

// ----------------------------------------

export type EventProcessorData = {
  plots: Map<string, ethers.BigNumber>;
  deposits: Map<
    Token,
    {
      [stem: string]: {
        amount: ethers.BigNumber;
        bdv: ethers.BigNumber;
      };
    }
  >;
};

export class EventProcessor {
  private readonly sdk: BeanstalkSDK;

  account: string;
  whitelist: Set<Token>;
  plots: EventProcessorData["plots"];
  deposits: EventProcessorData["deposits"]; // token => stem => amount

  /// /////////////////////// SETUP //////////////////////////

  constructor(sdk: BeanstalkSDK, account: string, initialState?: Partial<EventProcessorData>) {
    this.sdk = sdk;

    // Setup
    this.account = account.toLowerCase();
    this.whitelist = sdk.tokens.siloWhitelist;

    // Silo
    this.deposits = initialState?.deposits || setToMap(this.whitelist);

    // Field
    this.plots = initialState?.plots || new Map();

    return this;
  }

  ingest<T extends EventManager.Event>(event: T) {
    if (!event.event) {
      return;
    }
    if (!SupportedEventsSet.has(event.event as typeof SupportedEvents[number])) {
      return;
    }
    // @ts-ignore
    return this[event.event as typeof SupportedEvents[number]]?.(event as any);
  }

  ingestAll<T extends EventManager.Event>(events: T[]) {
    events.forEach((event) => {
      this.ingest(event);
    });
    return this;
  }

  data() {
    return {
      plots: this.plots,
      deposits: this.deposits
    };
  }

  // Utils
  getToken(event: EventManager.Event): Token {
    const token = this.sdk.tokens.findByAddress(event?.args?.token);
    if (!token) {
      this.sdk.debug("token not found for this event", { event });
      throw new Error(`token not found for address ${event?.args?.token}`);
    }

    return token;
  }

  // /// /////////////////////// FIELD //////////////////////////

  Sow(event: EventManager.Simplify<SowEvent>) {
    this.plots.set(event.args.index.toString(), event.args.pods);
  }

  Harvest(event: EventManager.Simplify<HarvestEvent>) {
    let beansClaimed = event.args.beans;

    const plots = [...event.args.plots].sort((a, b) => a.sub(b).toNumber());

    plots.forEach((indexBN) => {
      const index = indexBN.toString();
      const plot = this.plots.get(index); // get the number of Pods stored at this index

      if (!plot) return;
      if (beansClaimed.lt(plot)) {
        // ----------------------------------------
        // A Plot was partially Harvested. Example:
        // Event: Sow
        //  index  = 10
        //  amount = 10
        //
        // I call harvest when harvestableIndex = 14 (I harvest 10,11,12,13)
        //
        // Event: Harvest
        //  args.beans = 4
        //  args.plots = [10]
        //  beansClaimed  = 4
        //  partialIndex  = 4 + 10 = 14
        //  partialAmount = 10 - 4 = 6
        //
        // Add Plot with 6 Pods at index 14
        // Remove Plot at index 10.
        // ----------------------------------------
        const partialIndex = beansClaimed.add(indexBN); // index of new plot
        const partialAmount = plot.sub(beansClaimed); // remaining pods in new plot

        this.plots.set(partialIndex.toString(), partialAmount); // add new plot (with remaining pods)
      } else {
        // This plot was fully harvested; it'll be deleted below
        beansClaimed = beansClaimed.sub(plot);
      }

      // Always delete the old plot
      this.plots.delete(index);
    });
  }

  PlotTransfer(event: EventManager.Simplify<PlotTransferEvent>) {
    // Numerical "index" of the Plot. Absolute, with respect to Pod 0.
    const transferIndex = event.args.id;
    const podsTransferred = event.args.pods;

    // This account received a Plot
    if (event.args.to.toLowerCase() === this.account) {
      this.plots.set(transferIndex.toString(), podsTransferred);
    }

    // This account sent a Plot
    else {
      const indexStr = transferIndex.toString();
      const plot = this.plots.get(indexStr);

      // ----------------------------------------
      // The PlotTransfer event doesn't contain info
      // about the `start` position of a Transfer.
      // Say for example I have the following plot:
      //
      //  0       9 10         20              END
      // [---------[0123456789)-----------------]
      //                 ^
      // PlotTransfer   [56789)
      //                 15    20
      //
      // PlotTransfer(from=0x, to=0x, id=15, pods=5)
      // This means we send Pods: 15, 16, 17, 18, 19
      //
      // However this Plot doesn't exist yet in our
      // cache. To find it we search for the Plot
      // beginning at 10 and ending at 20, then
      // split it depending on params provided in
      // the PlotTransfer event.
      // ----------------------------------------

      // A known Plot was sent (starting from the first Pod).
      if (plot !== undefined) {
        // A known Plot was partially sent.
        if (!podsTransferred.eq(plot)) {
          const partialIndex = transferIndex.add(podsTransferred); // index of new plot
          const partialAmount = plot.sub(podsTransferred); // remaining pods in new plot

          this.plots.set(partialIndex.toString(), partialAmount);
        }

        this.plots.delete(indexStr);
      }

      // Pods were partially sent from a non-zero starting index in one of the
      // farmer's Plots. Find the parent Plot in our cache.
      else {
        let i = 0;
        const plotIndices = Array.from(this.plots.keys());

        while (i < plotIndices.length) {
          // Setup the boundaries of this Plot
          const startIndexStr = plotIndices[i];
          const startIndex = ethers.BigNumber.from(startIndexStr);
          const podsAtIndex = this.plots.get(startIndexStr)!;
          const endIndex = startIndex.add(podsAtIndex);

          // Check if the Transfer happened within this Plot
          if (startIndex.lte(transferIndex) && endIndex.gt(transferIndex)) {
            const transferredFromBeginning = startIndex.eq(transferIndex);

            // ----------------------------------------
            // Left slice. This is the part that
            // the user keeps (they sent the other part).
            //
            // Following the above example:
            //  transferIndex   = 15
            //  podsTransferred = 5
            //  startIndex      = 10
            //  endIndex        = 20
            //
            // This would update the existing Plot such that:
            //  this.plots[10] = (15 - 10) = 5
            // containing Pods 10, 11, 12, 13, 14
            // ----------------------------------------
            if (transferredFromBeginning) {
              // Started at the beginning of the plot.
              // New plot will be created below
              this.plots.delete(startIndexStr);
            } else {
              // Started in the middle of the plot.
              // Create a slice on the left side; this would be pods 0-4
              // in the example below
              const leftStartIndexStr = startIndexStr;
              const leftAmount = transferIndex.sub(startIndex);

              // Override the plot at this index, we'll create one for the rest below
              this.plots.set(leftStartIndexStr, leftAmount);
            }

            // ----------------------------------------
            // Right slice. Handles the below case where
            // the amount sent doesn't reach the end
            // of the Plot (i.e. I sent Pods in the middle).
            //
            //  0       9 10         20              END
            // [---------[0123456789)-----------------]
            //                 ^
            // PlotTransfer   [567)
            //                 15  18
            //
            //  transferIndex   = 15
            //  podsTransferred = 3
            //  startIndex      = 10
            //  endIndex        = 20
            //
            // PlotTransfer(from=0x, to=0x, id=15, pods=3)
            // This means we send Pods: 15, 16, 17.
            // ----------------------------------------
            if (!transferIndex.eq(endIndex)) {
              // s2 = 15 + 3 = 18
              // Requires another split since 18 != 20
              const rightStartIndex = transferIndex.add(podsTransferred);
              const transferredToEnd = rightStartIndex.eq(endIndex);

              if (!transferredToEnd) {
                // Create a new plot at s2=18 with 20-18 = 2 Pods.
                const rightStartIndexStr = rightStartIndex.toString();
                const rightAmount = endIndex.sub(rightStartIndex);

                // Create a new plot for the right side
                this.plots.set(rightStartIndexStr, rightAmount);
              }
            }

            break;
          }
          i += 1;
        }
      }
    }
  }

  parsePlots({ harvestableIndex }: { harvestableIndex: ethers.BigNumber }) {
    let pods = ZERO_BN;
    let harvestablePods = ZERO_BN;

    const unharvestablePlots: Map<string, ethers.BigNumber> = new Map();
    const harvestablePlots: Map<string, ethers.BigNumber> = new Map();

    this.plots.forEach((plot, startIndexStr) => {
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

  // /// /////////////////////// SILO: DEPOSIT  //////////////////////////

  // eslint-disable-next-line class-methods-use-this
  _upsertDeposit(
    existing: { amount: ethers.BigNumber; bdv: ethers.BigNumber } | undefined,
    amount: ethers.BigNumber,
    bdv: ethers.BigNumber
  ) {
    return existing
      ? {
          amount: existing.amount.add(amount),
          bdv: existing.bdv.add(bdv)
        }
      : {
          amount,
          bdv
        };
  }

  _removeDeposit(stem: string, token: Token, amount: ethers.BigNumber) {
    if (!this.whitelist.has(token)) throw new Error(`Attempted to process an event with an unknown token: ${token}`);
    const existingDeposit = this.deposits.get(token)?.[stem];
    if (!existingDeposit) throw new Error(`Received a 'RemoveDeposit' event for an unknown deposit: ${token.address} ${stem}`);

    // BDV scales linearly with the amount of the underlying token.
    // Ex. if we remove 60% of the `amount`, we also remove 60% of the BDV.
    // Because of this, the `RemoveDeposit` event doesn't contain the BDV to save gas.

    // @note order of mul/div matters here to prevent underflow
    const bdv = amount.mul(existingDeposit.bdv).div(existingDeposit.amount);

    this.deposits.set(token, {
      ...this.deposits.get(token),
      [stem]: this._upsertDeposit(existingDeposit, amount.mul(-1), bdv.mul(-1))
    });

    if (this.deposits.get(token)?.[stem]?.amount?.eq(0)) {
      // FIXME: verify this works
      delete this.deposits.get(token)?.[stem];
    }
  }

  AddDeposit(event: EventManager.Simplify<AddDepositEvent>) {
    const token = this.getToken(event);
    const stem = event.args.stem.toString();

    if (!this.whitelist.has(token)) throw new Error(`Attempted to process an event with an unknown token: ${token}`);

    const tokDeposits = this.deposits.get(token);
    this.deposits.set(token, {
      ...tokDeposits,
      [stem]: this._upsertDeposit(tokDeposits?.[stem], event.args.amount, event.args.bdv)
    });
  }

  RemoveDeposit(event: EventManager.Simplify<RemoveDepositEvent>) {
    const token = this.getToken(event);
    const stem = event.args.stem.toString();
    this._removeDeposit(stem, token, event.args.amount);
  }

  RemoveDeposits(event: EventManager.Simplify<RemoveDepositsEvent>) {
    const token = this.getToken(event);
    event.args.stems.forEach((stem, index) => {
      this._removeDeposit(stem.toString(), token, event.args.amounts[index]);
    });
  }
}
