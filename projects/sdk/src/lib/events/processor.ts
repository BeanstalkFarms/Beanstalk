import { ethers } from "ethers";
import { Token } from "src/classes/Token";
import {
  // SowEvent,
  // HarvestEvent,
  // PlotTransferEvent,
  AddDepositEvent,
  RemoveDepositEvent,
  RemoveDepositsEvent
} from "src/constants/generated/protocol/abi/Beanstalk";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { EventManager } from "src/lib/events/EventManager";

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

export type DepositCrateRaw = {
  amount: ethers.BigNumber;
  bdv: ethers.BigNumber;
};

export type EventProcessorData = {
  plots: Map<string, ethers.BigNumber>;
  deposits: Map<Token, { [stem: string]: DepositCrateRaw }>;
};

export class EventProcessor {
  private readonly sdk: BeanstalkSDK;

  // ----------------------------
  // |       PROCESSING         |
  // ----------------------------
  account: string;
  whitelist: Set<Token>;

  // ----------------------------
  // |      DATA STORAGE        |
  // ----------------------------

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
    return this.data();
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

  // Sow(event: Simplify<SowEvent>) {
  //   const index       = tokenBN(event.args.index, PODS).toString();
  //   this.plots[index] = tokenBN(event.args.pods,  PODS);
  // }

  // Harvest(event: Simplify<HarvestEvent>) {
  //   let beansClaimed = tokenBN(event.args.beans, Bean);
  //   const plots = (
  //     event.args.plots
  //       .map((_index) => tokenBN(_index, Bean))
  //       .sort((a, b) => a.minus(b).toNumber())
  //   );
  //   plots.forEach((indexBN) => {
  //     const index = indexBN.toString();
  //     if (beansClaimed.isLessThan(this.plots[index])) {
  //       // ----------------------------------------
  //       // A Plot was partially Harvested. Example:
  //       // Event: Sow
  //       //  index  = 10
  //       //  amount = 10
  //       //
  //       // I call harvest when harvestableIndex = 14 (I harvest 10,11,12,13)
  //       //
  //       // Event: Harvest
  //       //  args.beans = 4
  //       //  args.plots = [10]
  //       //  beansClaimed  = 4
  //       //  partialIndex  = 4 + 10 = 14
  //       //  partialAmount = 10 - 4 = 6
  //       //
  //       // Add Plot with 6 Pods at index 14
  //       // Remove Plot at index 10.
  //       // ----------------------------------------
  //       const partialIndex  = beansClaimed.plus(indexBN);
  //       const partialAmount = this.plots[index].minus(beansClaimed);
  //       this.plots = {
  //         ...this.plots,
  //         [partialIndex.toString()]: partialAmount,
  //       };
  //     } else {
  //       beansClaimed = beansClaimed.minus(this.plots[index]);
  //     }
  //     delete this.plots[index];
  //   });
  // }

  // PlotTransfer(event: Simplify<PlotTransferEvent>) {
  //   // Numerical "index" of the Plot. Absolute, with respect to Pod 0.
  //   const transferIndex   = tokenBN(event.args.id, Bean);
  //   const podsTransferred = tokenBN(event.args.pods, Bean);

  //   if (event.args.to.toLowerCase() === this.account) {
  //     // This account received a Plot
  //     this.plots[transferIndex.toString()] = podsTransferred;
  //   }
  //   else {
  //     // This account sent a Plot
  //     const indexStr = transferIndex.toString();

  //     // ----------------------------------------
  //     // The PlotTransfer event doesn't contain info
  //     // about the `start` position of a Transfer.
  //     // Say for example I have the following plot:
  //     //
  //     //  0       9 10         20              END
  //     // [---------[0123456789)-----------------]
  //     //                 ^
  //     // PlotTransfer   [56789)
  //     //                 15    20
  //     //
  //     // PlotTransfer(from=0x, to=0x, id=15, pods=5)
  //     // This means we send Pods: 15, 16, 17, 18, 19
  //     //
  //     // However this Plot doesn't exist yet in our
  //     // cache. To find it we search for the Plot
  //     // beginning at 10 and ending at 20, then
  //     // split it depending on params provided in
  //     // the PlotTransfer event.
  //     // ----------------------------------------
  //     if (this.plots[indexStr] !== undefined) {
  //       // A known Plot was sent.
  //       if (!podsTransferred.isEqualTo(this.plots[indexStr])) {
  //         const newStartIndex = transferIndex.plus(podsTransferred);
  //         this.plots[newStartIndex.toString()] = this.plots[indexStr].minus(podsTransferred);
  //       }
  //       delete this.plots[indexStr];
  //     }
  //     else {
  //       // A Plot was partially sent from a non-zero
  //       // starting index. Find the containing Plot
  //       // in our cache.
  //       let i = 0;
  //       let found = false;
  //       const plotIndices = Object.keys(this.plots);
  //       while (found === false && i < plotIndices.length) {
  //         // Setup the boundaries of this Plot
  //         const startIndex = BN(plotIndices[i]);
  //         const endIndex   = startIndex.plus(this.plots[startIndex.toString()]);
  //         // Check if the Transfer happened within this Plot
  //         if (startIndex.isLessThanOrEqualTo(transferIndex)
  //            && endIndex.isGreaterThan(transferIndex)) {
  //           // ----------------------------------------
  //           // Slice #1. This is the part that
  //           // the user keeps (they sent the other part).
  //           //
  //           // Following the above example:
  //           //  transferIndex   = 15
  //           //  podsTransferred = 5
  //           //  startIndex      = 10
  //           //  endIndex        = 20
  //           //
  //           // This would update the existing Plot such that:
  //           //  this.plots[10] = (15 - 10) = 5
  //           // containing Pods 10, 11, 12, 13, 14
  //           // ----------------------------------------
  //           if (transferIndex.eq(startIndex)) {
  //             delete this.plots[startIndex.toString()];
  //           } else {
  //             this.plots[startIndex.toString()] = transferIndex.minus(startIndex);
  //           }

  //           // ----------------------------------------
  //           // Slice #2. Handles the below case where
  //           // the amount sent doesn't reach the end
  //           // of the Plot (i.e. I sent Pods in the middle.
  //           //
  //           //  0       9 10         20              END
  //           // [---------[0123456789)-----------------]
  //           //                 ^
  //           // PlotTransfer   [567)
  //           //                 15  18
  //           //
  //           //  transferIndex   = 15
  //           //  podsTransferred = 3
  //           //  startIndex      = 10
  //           //  endIndex        = 20
  //           //
  //           // PlotTransfer(from=0x, to=0x, id=15, pods=3)
  //           // This means we send Pods: 15, 16, 17.
  //           // ----------------------------------------
  //           if (!transferIndex.isEqualTo(endIndex)) {
  //             // s2 = 15 + 3 = 18
  //             // Requires another split since 18 != 20
  //             const s2 = transferIndex.plus(podsTransferred);
  //             const requiresAnotherSplit = !s2.isEqualTo(endIndex);
  //             if (requiresAnotherSplit) {
  //               // Create a new plot at s2=18 with 20-18 Pods.
  //               const s2Str = s2.toString();
  //               this.plots[s2Str] = endIndex.minus(s2);
  //               if (this.plots[s2Str].isEqualTo(0)) {
  //                 delete this.plots[s2Str];
  //               }
  //             }
  //           }
  //           found = true;
  //         }
  //         i += 1;
  //       }
  //     }
  //   }
  // }

  // parsePlots(_harvestableIndex: BigNumber) {
  //   return EventProcessor._parsePlots(
  //     this.plots,
  //     _harvestableIndex
  //   );
  // }

  // static _parsePlots(
  //   plots: EventProcessorData['plots'],
  //   index: BigNumber
  // ) {
  //   console.debug(`[EventProcessor] Parsing plots with index ${index.toString()}`);

  //   let pods = new BigNumber(0);
  //   let harvestablePods = new BigNumber(0);
  //   const unharvestablePlots  : PlotMap<BigNumber> = {};
  //   const harvestablePlots    : PlotMap<BigNumber> = {};

  //   Object.keys(plots).forEach((p) => {
  //     if (plots[p].plus(p).isLessThanOrEqualTo(index)) {
  //       harvestablePods = harvestablePods.plus(plots[p]);
  //       harvestablePlots[p] = plots[p];
  //     } else if (new BigNumber(p).isLessThan(index)) {
  //       harvestablePods = harvestablePods.plus(index.minus(p));
  //       pods = pods.plus(
  //         plots[p].minus(index.minus(p))
  //       );
  //       harvestablePlots[p] = index.minus(p);
  //       unharvestablePlots[index.minus(p).plus(p).toString()] = plots[p].minus(
  //         index.minus(p)
  //       );
  //     } else {
  //       pods = pods.plus(plots[p]);
  //       unharvestablePlots[p] = plots[p];
  //     }
  //   });

  //   // FIXME: "unharvestable pods" are just Pods,
  //   // but we can't reuse "plots" in the same way.
  //   return {
  //     pods,
  //     harvestablePods,
  //     plots: unharvestablePlots,
  //     harvestablePlots
  //   };
  // }

  // /// /////////////////////// SILO: DEPOSIT  //////////////////////////

  // eslint-disable-next-line class-methods-use-this
  _upsertDeposit(existing: DepositCrateRaw | undefined, amount: ethers.BigNumber, bdv: ethers.BigNumber) {
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
    //
    // @note order of mul/div matters here to prevent underflow
    const bdv = amount.mul(existingDeposit.bdv).div(existingDeposit.amount);

    this.deposits.set(token, {
      ...this.deposits.get(token),
      [stem]: this._upsertDeposit(existingDeposit, amount.mul(-1), bdv.mul(-1))
    });

    if (this.deposits.get(token)?.[stem]?.amount?.eq(0)) {
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
