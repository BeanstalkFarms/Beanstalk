import { useCallback, useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import useCastApolloQuery from '~/hooks/app/useCastApolloQuery';
import {
  PodListing,
  castPodListing,
  PodOrder,
  castPodOrder,
  PricingTypes,
  PricingFunctions,
} from '~/state/farmer/market';
import {
  MarketStatus,
  useFarmerPodListingsLazyQuery,
  useFarmerPodOrdersLazyQuery,
} from '../../../generated/graphql';

import useAccount from '~/hooks/ledger/useAccount';
import useHarvestableIndex from '../../beanstalk/useHarvestableIndex';
import { ZERO_BN } from '~/constants';

/**
 * A single interface for items in the "Your Orders" tab.
 */
export type FarmerMarketOrder = {
  /// ///////////// Identifiers ////////////////

  id: string;
  action: 'buy' | 'sell';
  type: 'order' | 'listing';
  source: PodListing | PodOrder;

  /// ///////////// Pricing ////////////////

  pricingType: PricingTypes;
  pricePerPod: BigNumber;
  pricingFunction: PricingFunctions;

  /// ///////////// Columns ////////////////

  /**
   * Order: # of Pods that could be acquired if the Order is completely Filled
   * Listing: # of Pods in the initial listing
   */
  amountPods: BigNumber;
  amountPodsFilled: BigNumber;

  /**
   * Order: # of Beans that were put into the order initially
   * Listing: # of Beans that could be received if Listing is completely Filled
   */
  amountBeans: BigNumber;
  amountBeansFilled: BigNumber;

  /**
   * Order: 0 to `max place in line`
   * Listing': `index - harvestable index`
   */
  placeInLine: BigNumber;
  
  /**
   * Percentage filled.
   */
  fillPct: BigNumber;
  
  /**
   * Order: 0 (orders don't have an expiry)
   * Listing: max harvestable index minus harvestable index
   */
  expiry: BigNumber;
  
  /// ///////////// Metadata ////////////////

  status: MarketStatus;
  createdAt: string;
  creationHash: string;
};

const castOrderToHistoryItem = (order: PodOrder): FarmerMarketOrder => ({
  // Identifiers
  id: order.id,
  action: 'buy',
  type: 'order',
  source: order,

  // Pricing
  pricingType: order.pricingType,
  pricePerPod: order.pricePerPod,
  pricingFunction: null,

  // Columns
  amountPods: order.podAmount,
  amountPodsFilled: order.podAmountFilled,
  amountBeans: order.podAmount.times(order.pricePerPod),
  amountBeansFilled: order.podAmountFilled.times(order.pricePerPod),
  placeInLine: order.maxPlaceInLine,
  fillPct: order.podAmountFilled.div(order.podAmount).times(100),
  expiry: ZERO_BN, // pod orders don't expire
  
  // Metadata
  status: order.status,
  createdAt: order.createdAt,
  creationHash: order.creationHash,
});

const castListingToHistoryItem = (listing: PodListing): FarmerMarketOrder => ({
  // Identifiers
  id: listing.id,
  action: 'sell',
  type: 'listing',
  source: listing,

  // Pricing
  pricingType: listing.pricingType,
  pricePerPod: listing.pricePerPod,
  pricingFunction: null,

  // Columns
  amountPods: listing.originalAmount,
  amountPodsFilled: listing.filled,
  amountBeans: listing.originalAmount.times(listing.pricePerPod),
  amountBeansFilled: listing.filled.times(listing.pricePerPod),
  placeInLine: listing.placeInLine,
  fillPct: listing.filled.div(listing.originalAmount).times(100),
  expiry: listing.expiry,
  
  // Metadata
  status: listing.status,
  createdAt: listing.createdAt,
  creationHash: listing.creationHash,
});

export function useFetchFarmerMarketItems() {
  const account = useAccount();
  
  const [fetchListings, listingsQuery] = useFarmerPodListingsLazyQuery({
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-only',
    notifyOnNetworkStatusChange: true,
  });
  const [fetchOrders, ordersQuery] = useFarmerPodOrdersLazyQuery({
    fetchPolicy: 'network-only',
    nextFetchPolicy: 'cache-only',
    notifyOnNetworkStatusChange: true,
  });

  return {
    listingsQuery,
    ordersQuery,
    fetch: useCallback(() => {
      if (!account) return;
      const opts = {
        variables: {
          account: account.toLowerCase(),
          createdAt_gt: 0,
        }
      };
      fetchListings(opts);
      fetchOrders(opts);
    }, [account, fetchListings, fetchOrders]),
  };
}

const MARKET_STATUS_TO_ORDER = {
  [MarketStatus.Active]: 0,
  [MarketStatus.Expired]: 1,
  [MarketStatus.Filled]: 2,
  [MarketStatus.FilledPartial]: 3,
  [MarketStatus.Cancelled]: 4,
  [MarketStatus.CancelledPartial]: 5,
};

export default function useFarmerMarket() {
  const harvestableIndex = useHarvestableIndex();
  const { fetch, listingsQuery, ordersQuery } = useFetchFarmerMarketItems();

  useEffect(() => {
    fetch();
  }, [fetch]);

  // Cast query data to decimal form
  const listingItems = useCastApolloQuery<FarmerMarketOrder>(
    listingsQuery,
    'podListings',
    useCallback((l) => castListingToHistoryItem(castPodListing(l, harvestableIndex)), [harvestableIndex]),
  );
  const orderItems = useCastApolloQuery<FarmerMarketOrder>(
    ordersQuery,
    'podOrders',
    useCallback((o) => castOrderToHistoryItem(castPodOrder(o)), []),
  );

  // Cast query data to history item form
  const data = useMemo(() => 
    // shortcut to check if listings / orders are still loading
    [
      ...listingItems || [],
      ...orderItems || [],
    ].sort((a, b) => {
      // Sort by MARKET_STATUS_TO_ORDER, then by creation date
      const x = MARKET_STATUS_TO_ORDER[a.status] - MARKET_STATUS_TO_ORDER[b.status];
      if (x !== 0) return x;
      return parseInt(b.createdAt, 10) - parseInt(a.createdAt, 10);
    }),
   [listingItems, orderItems]
  );

  return {
    data,
    loading: listingsQuery.loading || ordersQuery.loading,
  };
}
