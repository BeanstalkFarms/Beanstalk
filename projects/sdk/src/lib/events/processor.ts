import { BigNumber as EBN, ethers } from "ethers";
import { Token } from "src/classes/Token";
import {
  SowEvent,
  HarvestEvent,
  PlotTransferEvent,
  AddDepositEvent,
  RemoveDepositEvent,
  RemoveDepositsEvent,
  AddWithdrawalEvent,
  RemoveWithdrawalEvent,
  RemoveWithdrawalsEvent,
  PodListingCreatedEvent,
  PodListingCancelledEvent,
  PodListingFilledEvent,
  PodOrderCreatedEvent,
  PodOrderCancelledEvent,
  PodOrderFilledEvent
} from "src/constants/generated/protocol/abi/Beanstalk";
import { StringMap } from "../../types";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { PodListing, PodOrder } from "./types";

// ----------------------------------------

const SupportedEvents = [
  // Field
  "Sow",
  "Harvest",
  "PlotTransfer",
  // Silo
  "AddDeposit",
  "RemoveDeposit",
  "RemoveDeposits",
  "AddWithdrawal",
  "RemoveWithdrawal",
  "RemoveWithdrawals",
  // Market
  "PodListingCreated",
  "PodListingCancelled",
  "PodListingFilled",
  "PodOrderCreated",
  "PodOrderCancelled",
  "PodOrderFilled"
] as const;
const SupportedEventsSet = new Set(SupportedEvents);

// ----------------------------------------

// TODO: commeting these out for now, tbd if they're needed.
// export const BN = (v: EBN | BigNumber.Value) => (v instanceof EBN ? new BigNumber(v.toString()) : new BigNumber(v));
// export const decimalBN = (v: EBN | BigNumber.Value, decimals: number) => BN(v).div(10 ** decimals);
// export const tokenBN = (v: EBN | BigNumber.Value, token: Token) => decimalBN(v, token.decimals);

export const setToMap = (tokens: Set<Token>): Map<Token, any> => {
  const map = new Map<Token, any>();
  for (const token of tokens) {
    map.set(token, {});
  }
  return map;
};

// ----------------------------------------

export type EventProcessingParameters = {
  season: EBN;
  whitelist: Set<Token>;
};

export type DepositCrateRaw = {
  amount: EBN;
  bdv: EBN;
};
export type WithdrawalCrateRaw = {
  amount: EBN;
};

export type EventProcessorData = {
  plots: StringMap<EBN>;
  deposits: Map<
    Token,
    {
      [season: string]: DepositCrateRaw;
    }
  >;
  withdrawals: Map<
    Token,
    {
      [season: string]: WithdrawalCrateRaw;
    }
  >;
  listings: {
    [plotIndex: string]: PodListing; // FIXME: need to use EBN here
  };
  orders: {
    [orderId: string]: PodOrder; // FIXME: need to use EBN here
  };
};

export type EventKeys = "event" | "args" | "blockNumber" | "transactionIndex" | "transactionHash" | "logIndex";
export type Simplify<T extends ethers.Event> = Pick<T, EventKeys> & { returnValues?: any };
export type Event = Simplify<ethers.Event>;

//

export default class EventProcessor {
  private readonly sdk: BeanstalkSDK;
  // ----------------------------
  // |       PROCESSING         |
  // ----------------------------
  account: string;

  epp: EventProcessingParameters;

  // ----------------------------
  // |      DATA STORAGE        |
  // ----------------------------

  plots: EventProcessorData["plots"];
  deposits: EventProcessorData["deposits"]; // token => season => amount
  withdrawals: EventProcessorData["withdrawals"]; // token => season => amount
  listings: EventProcessorData["listings"];
  orders: EventProcessorData["orders"];

  /// /////////////////////// SETUP //////////////////////////

  constructor(sdk: BeanstalkSDK, account: string, epp: EventProcessingParameters, initialState?: Partial<EventProcessorData>) {
    if (!epp.whitelist || typeof epp !== "object") throw new Error("EventProcessor: Missing whitelist.");
    this.sdk = sdk;
    // Setup
    this.account = account.toLowerCase();
    this.epp = epp;
    // Silo
    this.deposits = initialState?.deposits || setToMap(this.epp.whitelist);
    this.withdrawals = initialState?.withdrawals || setToMap(this.epp.whitelist);
    // Field
    this.plots = initialState?.plots || {};
    this.listings = initialState?.listings || {};
    this.orders = initialState?.orders || {};
  }

  ingest<T extends Event>(event: T) {
    if (!event.event) {
      return;
    }
    if (!SupportedEventsSet.has(event.event as typeof SupportedEvents[number])) {
      return;
    }
    // @ts-ignore
    return this[event.event as typeof SupportedEvents[number]]?.(event as any);
  }

  ingestAll<T extends Event>(events: T[]) {
    events.forEach((event) => {
      this.ingest(event);
    });
    return this.data();
  }

  data() {
    return {
      plots: this.plots,
      deposits: this.deposits,
      withdrawals: this.withdrawals,
      listings: this.listings,
      orders: this.orders
    };
  }

  // Utils
  getToken(event: Event): Token {
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

  // /// /////////////////////// SILO: UTILS  //////////////////////////

  // parseWithdrawals(_token: Token, _season: EBN) {
  //   return EventProcessor._parseWithdrawals(
  //     this.withdrawals.get(_token)!,
  //     _season || this.epp.season
  //   );
  // }

  // static _parseWithdrawals(
  //   // withdrawals: EventProcessorData['withdrawals'] extends {[season:string]: infer I} ? I : undefined,
  //   withdrawals: MapValueType<EventProcessorData['withdrawals']>,
  //   currentSeason: EBN
  // ): {
  //   withdrawn: TokenSiloBalance['withdrawn'];
  //   claimable: TokenSiloBalance['claimable'];
  // } {
  //   let transitBalance = EBN.from(0);
  //   let receivableBalance = EBN.from(0);
  //   const transitWithdrawals: WithdrawalCrate[] = [];
  //   const receivableWithdrawals: WithdrawalCrate[] = [];

  //   // Split each withdrawal between `receivable` and `transit`.
  //   Object.keys(withdrawals).forEach((season: string) => {
  //     const v = withdrawals[season].amount;
  //     const s = EBN.from(season);
  //     if (s.lte(currentSeason)) {
  //       receivableBalance = receivableBalance.add(v);
  //       receivableWithdrawals.push({
  //         amount: v,
  //         season: s,
  //       });
  //     } else {
  //       transitBalance = transitBalance.plus(v);
  //       transitWithdrawals.push({
  //         amount: v,
  //         season: s,
  //       });
  //     }
  //   });

  //   return {
  //     withdrawn: {
  //       amount: transitBalance,
  //       crates: transitWithdrawals,
  //     },
  //     claimable: {
  //       amount: receivableBalance,
  //       crates: receivableWithdrawals,
  //     },
  //   };
  // }

  // /// /////////////////////// SILO: DEPOSIT  //////////////////////////

  // eslint-disable-next-line class-methods-use-this
  _upsertDeposit(existing: DepositCrateRaw | undefined, amount: EBN, bdv: EBN) {
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

  _removeDeposit(season: string, token: Token, amount: EBN) {
    if (!this.epp.whitelist.has(token)) throw new Error(`Attempted to process an event with an unknown token: ${token}`);
    const existingDeposit = this.deposits.get(token)?.[season];
    if (!existingDeposit) throw new Error(`Received a 'RemoveDeposit' event for an unknown deposit: ${token.address} ${season}`);

    // BDV scales linearly with the amount of the underlying token.
    // Ex. if we remove 60% of the `amount`, we also remove 60% of the BDV.
    // Because of this, the `RemoveDeposit` event doesn't contain the BDV to save gas.
    //
    // @note order of mul/div matters here to prevent underflow
    const bdv = amount.mul(existingDeposit.bdv).div(existingDeposit.amount);

    this.deposits.set(token, {
      ...this.deposits.get(token),
      [season]: this._upsertDeposit(existingDeposit, amount.mul(-1), bdv.mul(-1))
    });

    if (this.deposits.get(token)?.[season]?.amount?.eq(0)) {
      delete this.deposits.get(token)?.[season];
    }
  }

  AddDeposit(event: Simplify<AddDepositEvent>) {
    const token = this.getToken(event);
    if (!this.epp.whitelist.has(token)) throw new Error(`Attempted to process an event with an unknown token: ${token}`);

    const tokDeposits = this.deposits.get(token);
    this.deposits.set(token, {
      ...tokDeposits,
      [event.args.season]: this._upsertDeposit(tokDeposits?.[event.args.season], event.args.amount, event.args.bdv)
    });
  }

  RemoveDeposit(event: Simplify<RemoveDepositEvent>) {
    const token = this.getToken(event);
    this._removeDeposit(event.args.season.toString(), token, event.args.amount);
  }

  RemoveDeposits(event: Simplify<RemoveDepositsEvent>) {
    const token = this.getToken(event);
    event.args.seasons.forEach((season, index) => {
      this._removeDeposit(season.toString(), token, event.args.amounts[index]);
    });
  }

  /// /////////////////////// SILO: WITHDRAW  //////////////////////////

  // eslint-disable-next-line class-methods-use-this
  _upsertWithdrawal(existing: WithdrawalCrateRaw | undefined, amount: EBN) {
    return existing
      ? {
          amount: existing.amount.add(amount)
        }
      : {
          amount
        };
  }

  _removeWithdrawal(season: string, token: Token, _amount: EBN) {
    // For gas optimization reasons, `RemoveWithdrawal` is emitted
    // with a zero amount when the removeWithdrawal method is called with:
    //  (a) a token that doesn't exist;
    //  (b) a season that doesn't exist;
    //  (c) a combo of (a) and (b) where there is no existing Withdrawal.
    // In these cases we just ignore the event.
    if (_amount.eq(0) || !this.epp.whitelist.has(token)) return;

    const existingWithdrawal = this.withdrawals.get(token)?.[season];
    if (!existingWithdrawal) throw new Error(`Received a RemoveWithdrawal(s) event for an unknown Withdrawal: ${token} ${season}`);

    // Removing a Withdrawal always removes the entire season.
    delete this.withdrawals.get(token)?.[season];
  }

  AddWithdrawal(event: Simplify<AddWithdrawalEvent>) {
    const token = this.getToken(event);
    if (!this.epp.whitelist.has(token)) throw new Error(`Attempted to process an event with an unknown token: ${token}`);

    const tokWithdrawals = this.withdrawals.get(token);
    this.withdrawals.set(token, {
      ...tokWithdrawals,
      [event.args.season]: this._upsertWithdrawal(tokWithdrawals?.[event.args.season], event.args.amount)
    });
  }

  RemoveWithdrawal(event: Simplify<RemoveWithdrawalEvent>) {
    const token = this.getToken(event);
    this._removeWithdrawal(event.args.season.toString(), token, event.args.amount);
  }

  RemoveWithdrawals(event: Simplify<RemoveWithdrawalsEvent>) {
    const token = this.getToken(event);
    event.args.seasons.forEach((season) => {
      this._removeWithdrawal(season.toString(), token, event.args.amount);
    });
  }

  // /// /////////////////////// MARKET  //////////////////////////

  // PodListingCreated(event: Simplify<PodListingCreatedEvent>) {
  //   const id          = event.args.index.toString();
  //   const amount      = tokenBN(event.args.amount, BEAN[1]);
  //   this.listings[id] = {
  //     id:               id,
  //     account:          event.args.account.toLowerCase(),
  //     index:            tokenBN(event.args.index, BEAN[1]), // 6 dec
  //     start:            tokenBN(event.args.start, BEAN[1]), // 6 dec
  //     pricePerPod:      tokenBN(event.args.pricePerPod, BEAN[1]),
  //     maxHarvestableIndex: tokenBN(event.args.maxHarvestableIndex, BEAN[1]),
  //     mode:             event.args.mode.toString() as FarmToMode,
  //     amount:           amount,   //
  //     totalAmount:      amount,   //
  //     remainingAmount:  amount,   //
  //     filledAmount:     BN(0),    //
  //     status:           MarketStatus.Active,
  //     placeInLine:      ZERO_BN,  // FIXME
  //   };
  // }

  // PodListingCancelled(event: Simplify<PodListingCancelledEvent>) {
  //   const id = event.args.index.toString();
  //   if (this.listings[id]) delete this.listings[id];
  // }

  // /**
  //  * Notes on behavior:
  //  *
  //  * PodListingCreated                          => `status = active`
  //  * -> PodListingFilled (for the full amount)  => `status = filled-full`
  //  * -> PodListingFilled (for a partial amount) => `status = filled-partial`
  //  * -> PodListingCancelled                     => `status = cancelled`
  //  *
  //  * Every `PodListingFilled` event changes the `index` of the Listing.
  //  * When a Listing is partially filled, the Subgraph creates a new Listing
  //  * with the new index and `status = active`. The "old listing" now has
  //  * `status = filled-partial`.
  //  *
  //  * This EventProcessor is intended to stand in for the subgraph when we can't
  //  * connect, so we treat listings similarly:
  //  * 1. When a `PodListingFilled` event is received, delete the listing stored
  //  *    at the original `index` and create one at the new `index`. The new `index`
  //  *    is always: `previous index + start + amount`.
  //  *
  //  * @param event
  //  * @returns
  //  */
  // PodListingFilled(event: Simplify<PodListingFilledEvent>) {
  //   const id = event.args.index.toString();
  //   if (!this.listings[id]) return;

  //   const indexBN     = BN(event.args.index);
  //   const deltaAmount = tokenBN(event.args.amount, BEAN[1]);
  //   // const start   = tokenBN(event.args.start,  BEAN[1]);

  //   /// Move current listing's index up by |amount|
  //   ///  FIXME: does this match the new marketplace behavior? Believe
  //   ///  this assumes we are selling from the front (such that, as a listing
  //   ///  is sold, the index increases).
  //   const prevID = id;
  //   const currentListing = this.listings[prevID]; // copy
  //   delete this.listings[prevID];

  //   /// The new index of the Plot, now that some of it has been sold.
  //   const newIndex       = indexBN.plus(BN(event.args.amount)).plus(BN(event.args.start)); // no decimals
  //   const newID          = newIndex.toString();
  //   this.listings[newID] = currentListing;

  //   /// Bump up |amountSold| for this listing
  //   this.listings[newID].id              = newID;
  //   this.listings[newID].index           = tokenBN(newIndex, BEAN[1]);
  //   this.listings[newID].start           = new BigNumber(0); // After a Fill, the new start position is always zero (?)
  //   this.listings[newID].filledAmount    = currentListing.filledAmount.plus(deltaAmount);
  //   this.listings[newID].remainingAmount = currentListing.amount.minus(currentListing.filledAmount);
  //   // others stay the same, incl. currentListing.totalAmount, etc.

  //   const isFilled = this.listings[newID].remainingAmount.isEqualTo(0);
  //   if (isFilled) {
  //     this.listings[newID].status = MarketStatus.Filled;
  //     // delete this.listings[newID];
  //   }
  // }

  // PodOrderCreated(event: Simplify<PodOrderCreatedEvent>) {
  //   const id = event.args.id.toString();
  //   this.orders[id] = {
  //     id:               id,
  //     account:          event.args.account.toLowerCase(),
  //     maxPlaceInLine:   tokenBN(event.args.maxPlaceInLine, BEAN[1]),
  //     totalAmount:      tokenBN(event.args.amount, BEAN[1]),
  //     pricePerPod:      tokenBN(event.args.pricePerPod, BEAN[1]),
  //     remainingAmount:  tokenBN(event.args.amount, BEAN[1]),
  //     filledAmount:     new BigNumber(0),
  //     status:           MarketStatus.Active,
  //   };
  // }

  // PodOrderCancelled(event: Simplify<PodOrderCancelledEvent>) {
  //   const id = event.args.id.toString();
  //   if (this.orders[id]) delete this.orders[id];
  // }

  // PodOrderFilled(event: Simplify<PodOrderFilledEvent>) {
  //   const id = event.args.id.toString();
  //   if (!this.orders[id]) return;

  //   const amount = tokenBN(event.args.amount, BEAN[1]);
  //   this.orders[id].filledAmount    = this.orders[id].filledAmount.plus(amount);
  //   this.orders[id].remainingAmount = this.orders[id].totalAmount.minus(this.orders[id].filledAmount);

  //   /// Update status
  //   const isFilled = this.orders[id].remainingAmount.isEqualTo(0);
  //   if (isFilled) {
  //     this.orders[id].status = MarketStatus.Filled;
  //     // delete this.orders[id];
  //   }
  // }
}
