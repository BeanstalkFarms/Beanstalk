import { BigNumber } from 'bignumber.js';
import { atom, PrimitiveAtom, useAtom } from 'jotai';
import { atomWithReset } from 'jotai/utils';
import { useEffect, useMemo } from 'react';

import { PlotFragment } from '~/components/Common/Form';
import { PodListing, PodOrder } from '~/state/farmer/market';
import Token from '~/classes/Token';
import { ZERO_BN } from '~/constants';
import { BEAN, ETH, WETH } from '~/constants/tokens';
import usePreferredToken, {
  PreferredToken,
} from '~/hooks/farmer/usePreferredToken';
// ---------- TYPES ----------
type PartialOpenState = 0 | 1 | 2;

export type MayBN = BigNumber | null;

export enum PodOrderAction {
  BUY = 0,
  SELL = 1,
}

export enum PodOrderType {
  ORDER = 0,
  FILL = 1,
  LIST = 2,
}

export enum PricingFn {
  FIXED = 'FIXED',
  DYNAMIC = 'DYNAMIC',
}

export type PodsStateAtom<T extends BigNumber> = PrimitiveAtom<T>;
export type ValueAtom<T extends BigNumber | null> = PrimitiveAtom<T>;

// TODO - debounce;

// ---------- STATE ATOMS ----------

// chart type atom (pods / Depth || select listing voroni)
export const marketChartTypeAtom = atom<'depth' | 'listing'>('depth');

const _marketBottomTabsAtom = atom<PartialOpenState>(0);
const accordionSizes = {
  0: 44,
  1: 300,
  2: 750,
};
export const marketBottomTabsHeightAtom = atom(accordionSizes[0]);
// open state of the bottom tabs (market / your orders)
export const marketBottomTabsAtom = atom(
  (get) => get(_marketBottomTabsAtom),
  (_get, set, update: PartialOpenState) => {
    // set the height of the bottom tabs
    set(marketBottomTabsHeightAtom, accordionSizes[update]);
    // set the open state
    set(_marketBottomTabsAtom, update);
  }
);

// whether the PodOrderAction is Buy or Sell
// export const podsOrderActionAtom = atom<PodOrderAction | null>(null);
export const podsOrderActionAtom = atom<PodOrderAction>(PodOrderAction.BUY);

// whether the PodOrderAction is a filling a pod order or creating a new order
export const podsOrderTypeAtom = atom<PodOrderType>(PodOrderType.ORDER);

// the place in line of a specific order or maximum place in line of an order
export const placeInLineAtom = atomWithReset<MayBN>(null);

// whether a fixed or dynamic pricing function is being used for the active form
export const pricingFunctionAtom = atom<PricingFn>(PricingFn.FIXED);

// price in beans per pod
export const pricePerPodAtom = atom<BigNumber | null>(ZERO_BN);

// the price of the active form
export const orderPriceAtom = atom<MayBN>(null);

// is form being submitted
export const formSubmittingAtom = atom<boolean>(false);

// ----- SELECTED PLOT -----

// [SELL] = the amount of pods to sell from selected plot
export const selectedPlotAmountAtom = atom<MayBN>(null);

export const selectedPlotStartAtom = atom<MayBN>(null);

export const selectedPlotEndAtom = atom<MayBN>(null);

export const selectedPlotIndexAtom = atom<string | null>(null);

// [SELL] - the plot to sell
export const selectedPlotAtom = atom(
  (get) => {
    const index = get(selectedPlotIndexAtom);
    const start = get(selectedPlotStartAtom);
    const end = get(selectedPlotEndAtom);
    const amount = get(selectedPlotAmountAtom);

    if (!index && !start && !end && !amount) return null;
    return {
      index,
      start,
      end,
      amount,
    } as PlotFragment;
  },
  (_get, set, update: PlotFragment) => {
    set(selectedPlotAmountAtom, update.amount);
    set(selectedPlotStartAtom, update.start);
    set(selectedPlotEndAtom, update.end);
    set(selectedPlotIndexAtom, update.index);
  }
);

// the active listing in the form (BUY / SELL)
const _selectedListingAtom = atom<PodListing | null>(null);

// the active order
const _selectedOrderAtom = atom<PodOrder | null>(null);

// the total amount to fulfill a buy or sell order
export const fulfillAmountAtom = atom<MayBN>(null);

// the token used to fulfill a buy order
export const fulfillTokenAtom = atom<Token | null>(null);

// settings module atom
export const settingsSlippageAtom = atom<number>(0.1);

// ---------- GETTER ATOMS ----------

// [GETTER] => get all fields for buy order
export const buyFieldsAtomAtom = atom((get) => {
  const action = get(podsOrderActionAtom);
  const orderType = get(podsOrderTypeAtom);
  const placeInLine = get(placeInLineAtom);
  const pricingFn = get(pricingFunctionAtom);
  const price = get(orderPriceAtom);
  const selectedOrder = get(_selectedOrderAtom);
  const selectedListing = get(_selectedListingAtom);
  const fulfillAmount = get(fulfillAmountAtom);
  const fulfillToken = get(fulfillTokenAtom);
  const slippage = get(settingsSlippageAtom);

  return {
    action,
    orderType,
    placeInLine,
    pricingFn,
    price,
    selectedListing,
    selectedOrder,
    fulfillAmount,
    fulfillToken,
    slippage,
  };
});

// ---------- DERIVED ATOMS ----------

/**
 * [GET] => the action (BUY / SELL)
 * [SET] => resets the form values w/ exception of some fields
 */
export const podsOrderActionTypeAtom = atom(
  (get) => get(podsOrderActionAtom),
  (get, set) => {
    set(
      podsOrderActionAtom,
      get(podsOrderActionAtom) === PodOrderAction.BUY
        ? PodOrderAction.SELL
        : PodOrderAction.BUY
    );
    set(podsOrderTypeAtom, PodOrderType.ORDER);
    set(placeInLineAtom, ZERO_BN);
    set(pricingFunctionAtom, PricingFn.FIXED);
    set(orderPriceAtom, ZERO_BN);
    set(_selectedListingAtom, null);
    set(_selectedOrderAtom, null);
    set(fulfillAmountAtom, ZERO_BN);
  }
);

/**
 * [GET] => get selected PodOrder
 * [SET] => PodOrder & max place-in-line of given PodOrder
 */
export const selectedOrderAtom = atom(
  (get) => get(_selectedOrderAtom),
  (_get, set, order: PodOrder | null) => {
    set(_selectedOrderAtom, order);
    set(placeInLineAtom, order?.maxPlaceInLine || ZERO_BN);
  }
);

/**
 * [GET] => get selected PodListing
 * [SET] => PodListing & place-in-line of given PodListing
 */
export const selectedListingAtom = atom(
  (get) => get(_selectedListingAtom),
  (_get, set, listing: PodListing | null) => {
    set(_selectedListingAtom, listing);
    set(placeInLineAtom, listing?.placeInLine || ZERO_BN);
  }
);

// ---------- DERIVED UTILS ----------

export const listingPodsAmountAtom = atom((get) => {
  const selectedListing = get(_selectedListingAtom);
  return selectedListing?.amount || ZERO_BN;
});

// ---------- UTILS ----------

const PREFERRED_TOKENS: PreferredToken[] = [
  {
    token: BEAN,
    minimum: new BigNumber(1), // $1
  },
  {
    token: ETH,
    minimum: new BigNumber(0.001), // ~$2-4
  },
  {
    token: WETH,
    minimum: new BigNumber(0.001), // ~$2-4
  },
];

/**
 * implemented as a separate hook to account for current chain
 * @returns the preferred token for the current market
 */
export const useFulfillTokenAtom = () => {
  const [fulfillToken, setFulfillToken] = useAtom(fulfillTokenAtom);
  const baseToken = usePreferredToken(PREFERRED_TOKENS, 'use-best');

  useEffect(() => {
    if (baseToken && !fulfillToken) {
      setFulfillToken(baseToken);
    }
  }, [fulfillToken, baseToken, setFulfillToken]);

  return useMemo(
    () => [fulfillToken, setFulfillToken] as const,
    [fulfillToken, setFulfillToken]
  );
};
