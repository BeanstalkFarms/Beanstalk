import { TokenInstance } from '~/hooks/beanstalk/useTokens';
import React from 'react';
import BigNumber from 'bignumber.js';
import { FarmFromMode, FarmToMode } from '@beanstalk/sdk';
import { displayFullBN, displayTokenAmount } from '~/util/Tokens';
import copy from '~/constants/copy';
import {
  AmountsBySource,
  displayAmountsBySource,
} from '~/hooks/beanstalk/useBalancesUsedBySource';
import { BEAN, PODS, SPROUTS } from '../constants/tokens';
import { displayBN, trimAddress } from './index';

export enum ActionType {
  /// GENERIC
  BASE,
  END_TOKEN,
  SWAP,
  RECEIVE_TOKEN,
  TRANSFER_BALANCE,

  /// SILO
  DEPOSIT,
  WITHDRAW,
  IN_TRANSIT,
  UPDATE_SILO_REWARDS,
  CLAIM_WITHDRAWAL,
  TRANSFER,

  /// FIELD
  BUY_BEANS,
  SOW_BEANS,
  RECEIVE_PODS,
  HARVEST,
  RECEIVE_BEANS,
  TRANSFER_PODS,
  TRANSFER_MULTIPLE_PLOTS,

  /// MARKET
  CREATE_ORDER,
  BUY_PODS,
  SELL_PODS,

  /// BARN
  RINSE,
  BUY_FERTILIZER,
  RECEIVE_FERT_REWARDS,
  TRANSFER_FERTILIZER,

  /// SILO REWARDS
  ENROOT,
  PLANT,
  MOW,
}

/// ////////////////////////////// GENERIC /////////////////////////////////

export type BaseAction = {
  type: ActionType.BASE;
  message?: string | React.ReactElement;
};

export type EndTokenAction = {
  type: ActionType.END_TOKEN;
  token: TokenInstance;
};

export type SwapAction = {
  type: ActionType.SWAP;
  tokenIn: TokenInstance;
  source?: FarmFromMode;
  amountsBySource?: AmountsBySource;
  amountIn: BigNumber;
  tokenOut: TokenInstance;
  amountOut: BigNumber;
};

export type ReceiveTokenAction = {
  type: ActionType.RECEIVE_TOKEN;
  amount: BigNumber;
  token: TokenInstance;
  destination?: FarmToMode;
  to?: string;
  hideMessage?: boolean;
};

export type TransferBalanceAction = {
  type: ActionType.TRANSFER_BALANCE;
  amount: BigNumber;
  amountsBySource?: AmountsBySource;
  token: TokenInstance;
  source:
    | FarmFromMode.INTERNAL
    | FarmFromMode.EXTERNAL
    | FarmFromMode.INTERNAL_EXTERNAL;
  destination: FarmToMode;
  to?: string;
};

/// ////////////////////////////// SILO /////////////////////////////////
type SiloAction = {
  amount: BigNumber;
  token: TokenInstance;
};

export type SiloRewardsAction = {
  type: ActionType.UPDATE_SILO_REWARDS;
  stalk: BigNumber;
  seeds: BigNumber;
};

export type SiloDepositAction = SiloAction & {
  type: ActionType.DEPOSIT;
};

export type SiloWithdrawAction = SiloAction & {
  type: ActionType.WITHDRAW;
};

export type SiloTransitAction = SiloAction & {
  type: ActionType.IN_TRANSIT;
  destination: FarmToMode;
  withdrawSeasons: BigNumber;
};

export type SiloClaimAction = SiloAction & {
  type: ActionType.CLAIM_WITHDRAWAL;
  hideGraphic?: boolean;
};

export type SiloTransferAction = SiloAction & {
  type: ActionType.TRANSFER;
  stalk: BigNumber;
  seeds: BigNumber;
  to: string;
};

/// /////////////////////////// SILO REWARDS /////////////////////////////

export type MowAction = {
  type: ActionType.MOW;
  stalk: BigNumber;
};

export type EnrootAction = {
  type: ActionType.ENROOT;
  seeds: BigNumber;
  stalk: BigNumber;
};

export type PlantAction = {
  type: ActionType.PLANT;
  seeds: BigNumber;
  stalk: BigNumber;
  bean: BigNumber;
};

/// ////////////////////////////// FIELD /////////////////////////////////

type FieldAction = {};
export type BuyBeansAction = {
  type: ActionType.BUY_BEANS;
  beanAmount: BigNumber;
  beanPrice: BigNumber;
  token: TokenInstance;
  tokenAmount: BigNumber;
};

export type SowBeansAction = FieldAction & {
  type: ActionType.SOW_BEANS;
  amount: BigNumber;
};

export type ReceivePodsAction = FieldAction & {
  type: ActionType.RECEIVE_PODS;
  podAmount: BigNumber;
  placeInLine: BigNumber;
};

export type FieldHarvestAction = {
  type: ActionType.HARVEST;
  amount: BigNumber;
  hideGraphic?: boolean;
};

export type ReceiveBeansAction = {
  type: ActionType.RECEIVE_BEANS;
  amount: BigNumber;
  destination?: FarmToMode;
};

export type TransferPodsAction = {
  type: ActionType.TRANSFER_PODS;
  amount: BigNumber;
  address: string;
  placeInLine: BigNumber;
};

export type TransferMultiplePlotsAction = {
  type: ActionType.TRANSFER_MULTIPLE_PLOTS;
  amount: BigNumber;
  address: string;
  plots: number;
};

/// ////////////////////////////// MARKET /////////////////////////////////

export type CreateOrderAction = {
  type: ActionType.CREATE_ORDER;
  message: string; // lazy!
};

export type BuyPodsAction = {
  type: ActionType.BUY_PODS;
  podAmount: BigNumber;
  placeInLine: BigNumber;
  pricePerPod: BigNumber;
};

export type SellPodsAction = {
  type: ActionType.SELL_PODS;
  podAmount: BigNumber;
  placeInLine: BigNumber;
};

/// ////////////////////////////// BARN /////////////////////////////////

export type RinseAction = {
  type: ActionType.RINSE;
  amount: BigNumber;
  destination?: FarmToMode;
  hideGraphic?: boolean;
};

export type FertilizerBuyAction = {
  type: ActionType.BUY_FERTILIZER;
  amountIn: BigNumber;
  amountOut: BigNumber;
  humidity: BigNumber;
};

export type FertilizerRewardsAction = {
  type: ActionType.RECEIVE_FERT_REWARDS;
  amountOut: BigNumber;
};

export type FertilizerTransferAction = {
  type: ActionType.TRANSFER_FERTILIZER;
  to: string;
  fertAmount: BigNumber;
  sproutAmount: BigNumber;
};

/// /////////////////////////// AGGREGATE /////////////////////////////////

export type Action =
  /// GENERAL
  | BaseAction
  | EndTokenAction
  | SwapAction
  | ReceiveTokenAction
  | TransferBalanceAction
  /// SILO
  | SiloDepositAction
  | SiloWithdrawAction
  | SiloTransitAction
  | SiloRewardsAction
  | SiloClaimAction
  | SiloTransferAction
  /// SILO REWARDS
  | EnrootAction
  | PlantAction
  | MowAction
  /// FIELD
  | SowBeansAction
  | ReceivePodsAction
  | FieldHarvestAction
  | ReceiveBeansAction
  | BuyBeansAction
  | TransferPodsAction
  | TransferMultiplePlotsAction
  /// MARKET
  | CreateOrderAction
  | BuyPodsAction
  | SellPodsAction
  /// BARN
  | RinseAction
  | FertilizerBuyAction
  | FertilizerRewardsAction
  | FertilizerTransferAction;

// -----------------------------------------------------------------------

export const parseActionMessage = (a: Action) => {
  switch (a.type) {
    /// GENERIC
    case ActionType.END_TOKEN:
      return null;
    case ActionType.SWAP:
      if (a.tokenOut.isLP && !a.tokenOut.isUnripe) {
        const bySource = a.amountsBySource;
        const amtOutDisplay = displayTokenAmount(a.amountOut, a.tokenOut, {
          showName: false,
          showSymbol: true,
        });

        if (bySource && bySource.external.plus(bySource.internal).gt(0)) {
          const amountsBySourceDisplay = displayAmountsBySource(
            bySource,
            a.tokenIn,
            'of liquidity'
          );

          return `Add ${amountsBySourceDisplay.combined} for ${amtOutDisplay}.`;
        }

        return `Add ${displayTokenAmount(a.amountIn, a.tokenIn, {
          showName: false,
          showSymbol: true,
        })} of liquidity for ${amtOutDisplay}.`;
      }
      if (a.tokenIn.isLP && !a.tokenIn.isUnripe) {
        return `Burn ${displayTokenAmount(a.amountIn, a.tokenIn, {
          showName: false,
          showSymbol: true,
        })} for ${displayTokenAmount(a.amountOut, a.tokenOut, { showName: false, showSymbol: true })} of liquidity.`;
      }
      if (
        a.amountsBySource &&
        a.amountsBySource.internal.plus(a.amountsBySource.external).gt(0)
      ) {
        const bySourceDisplay = displayAmountsBySource(
          a.amountsBySource,
          a.tokenIn
        );
        return `Swap ${bySourceDisplay.combined} for ${displayTokenAmount(a.amountOut, a.tokenOut, { showName: false, showSymbol: true })}.`;
      }

      return `Swap ${displayTokenAmount(a.amountIn, a.tokenIn, {
        showName: false,
        showSymbol: true,
      })} for ${displayTokenAmount(a.amountOut, a.tokenOut, { showName: false, showSymbol: true })}.`;
    case ActionType.RECEIVE_TOKEN: {
      if (a.hideMessage) {
        return null;
      }
      const commonString = `Add ${displayFullBN(
        a.amount,
        a.token.displayDecimals
      )} ${a.token.name}`;
      if (a.destination) {
        if (a.to) {
          return `${commonString} to ${trimAddress(a.to, false)}'s ${
            copy.MODES[a.destination]
          }.`;
        }
        return `${commonString} to your ${copy.MODES[a.destination]}.`;
      }
      return `${commonString}.`;
    }
    case ActionType.TRANSFER_BALANCE:
      if (a.amountsBySource) {
        const bySourceDisplay = displayAmountsBySource(
          a.amountsBySource,
          a.token
        );
        return `Move ${bySourceDisplay.combined} to ${a.to ? `${trimAddress(a.to, false)}'s` : 'your'} ${copy.MODES[a.destination]}.`;
      }

      return a.to
        ? `Move ${displayTokenAmount(a.amount, a.token)} from your ${
            copy.MODES[a.source]
          } to ${trimAddress(a.to, false)}'s ${copy.MODES[a.destination]}.`
        : `Move ${displayTokenAmount(a.amount, a.token)} from your ${
            copy.MODES[a.source]
          } to your ${copy.MODES[a.destination]}.`;
    /// SILO
    case ActionType.DEPOSIT:
      return `Deposit ${displayTokenAmount(a.amount, a.token)} into the Silo.`;
    case ActionType.WITHDRAW:
      return `Withdraw ${displayTokenAmount(
        a.amount.abs(),
        a.token
      )} from the Silo.`;
    case ActionType.IN_TRANSIT:
      return `Receive ${displayTokenAmount(a.amount.abs(), a.token)} in your ${copy.MODES[a.destination]}.`;
    case ActionType.UPDATE_SILO_REWARDS: // FIXME: don't like "update" here
      return `${a.stalk.lt(0) ? 'Burn' : 'Receive'} ${displayFullBN(
        a.stalk.abs(),
        2
      )} Stalk and ${
        a.seeds.lt(0) ? (a.stalk.gte(0) ? 'burn ' : '') : ''
      }${displayFullBN(a.seeds.abs(), 2)} Seeds.`;
    case ActionType.CLAIM_WITHDRAWAL:
      return `Claim ${displayFullBN(a.amount, 2)} ${a.token.name}.`;
    case ActionType.TRANSFER:
      return `Transfer ${displayFullBN(a.amount)} ${
        a.token.name
      }, ${displayFullBN(a.stalk)} Stalk, and ${displayFullBN(
        a.seeds
      )} Seeds to ${trimAddress(a.to, true)}.`;

    /// SILO REWARDS
    case ActionType.MOW:
      return `Mow ${displayFullBN(a.stalk, 2)} Stalk.`;
    case ActionType.PLANT:
      return `Plant ${displayFullBN(a.bean, 2)} Bean${
        a.bean.gt(1) ? 's' : ''
      }, ${displayFullBN(a.stalk, 2)} Stalk, and ${displayFullBN(a.seeds, 2)} Seeds.`;
    case ActionType.ENROOT:
      return `Enroot ${displayFullBN(
        a.stalk,
        2
      )} Revitalized Stalk and ${displayFullBN(a.seeds, 2)} Revitalized Seeds.`;

    /// FIELD
    case ActionType.BUY_BEANS:
      // if user sows with beans, skip this step
      if (a.token.symbol === BEAN[1].symbol) return null;
      return `Buy ${displayFullBN(
        a.beanAmount,
        BEAN[1].displayDecimals
      )} Beans with ${displayFullBN(a.tokenAmount, a.token.displayDecimals)} ${
        a.token.name
      } for ~$${displayFullBN(a.beanPrice, BEAN[1].displayDecimals)} each.`;
    case ActionType.SOW_BEANS:
      return `Sow ${displayFullBN(a.amount, BEAN[1].displayDecimals)} ${
        a.amount.eq(new BigNumber(1)) ? 'Bean' : 'Beans'
      }.`;
    case ActionType.RECEIVE_PODS:
      return `Receive ${displayTokenAmount(
        a.podAmount,
        PODS
      )} at ${displayFullBN(a.placeInLine, 0)} in the Pod Line.`;
    case ActionType.HARVEST:
      return `Harvest ${displayFullBN(a.amount, PODS.displayDecimals)} Pods.`;
    // fixme: duplicate of RECEIVE_TOKEN?
    case ActionType.RECEIVE_BEANS:
      return `Add ${displayFullBN(a.amount, BEAN[1].displayDecimals)} Beans${
        a.destination ? ` to your ${copy.MODES[a.destination]}` : ''
      }.`;
    case ActionType.TRANSFER_PODS:
      return `Transfer ${displayTokenAmount(a.amount, PODS)} at ${displayBN(
        a.placeInLine
      )} in Line to ${a.address}.`;
    case ActionType.TRANSFER_MULTIPLE_PLOTS:
      return `Transfer ${displayTokenAmount(a.amount, PODS)} in ${
        a.plots
      } Plots to ${a.address}.`;

    /// BARN
    case ActionType.RINSE:
      return `Rinse ${displayFullBN(
        a.amount,
        SPROUTS.displayDecimals
      )} Sprouts${a.destination ? ` and send to your ${copy.MODES[a.destination]}.` : `.`}`;
    case ActionType.BUY_FERTILIZER:
      return `Buy ${displayFullBN(a.amountOut, 2)} Fertilizer at ${displayFullBN(
        a.humidity.multipliedBy(100),
        1
      )}% Humidity with ${displayFullBN(a.amountIn, 2)} wstETH.`;
    case ActionType.RECEIVE_FERT_REWARDS:
      return `Receive ${displayFullBN(a.amountOut, 2)} Sprouts.`;
    case ActionType.TRANSFER_FERTILIZER:
      return `Transfer ${displayFullBN(a.fertAmount, 0)} Fertilizer${a.fertAmount.gt(1) ? 's' : ''} with ${displayFullBN(a.sproutAmount, 2)} Sprout${a.sproutAmount.gt(1) ? 's' : ''} to ${trimAddress(a.to, false)}`;

    /// MARKET
    case ActionType.CREATE_ORDER:
      return a.message;
    case ActionType.BUY_PODS:
      return `Buy ${displayTokenAmount(a.podAmount, PODS)} at ${displayFullBN(
        a.placeInLine,
        0
      )} in the Pod Line for ${displayTokenAmount(
        a.pricePerPod,
        BEAN[1]
      )} per Pod.`;
    case ActionType.SELL_PODS:
      return `Sell ${displayTokenAmount(a.podAmount, PODS)} at ${displayFullBN(
        a.placeInLine,
        0
      )} in the Pod Line.`;

    /// DEFAULT
    default:
      return a.message || 'Unknown action';
  }
};
