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
}
