import BigNumber from 'bignumber.js';
import { useCallback, useMemo } from 'react';
import { MarketStatus, useAllPodOrdersQuery } from '~/generated/graphql';
import useCastApolloQuery from '~/hooks/app/useCastApolloQuery';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import usePodListings from '~/hooks/beanstalk/usePodListings';
import { castPodListing, castPodOrder, PodListing, PodOrder } from '~/state/farmer/market';

const useMarketData = () => {
  /// Beanstalk data
  const harvestableIndex = useHarvestableIndex();
  
  /// Queries
  const listingsQuery = usePodListings({ variables: { status: MarketStatus.Active, }, fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first', notifyOnNetworkStatusChange: true });
  const ordersQuery   = useAllPodOrdersQuery({ variables: { status: MarketStatus.Active }, fetchPolicy: 'cache-and-network', nextFetchPolicy: 'cache-first', notifyOnNetworkStatusChange: true });
  
  /// Query status
  const loading = listingsQuery.loading || ordersQuery.loading;
  const error   = listingsQuery.error   || ordersQuery.error;

  /// Cast query data to BigNumber, etc.
  const listings = useCastApolloQuery<PodListing>(listingsQuery, 'podListings', useCallback((_listing) => castPodListing(_listing, harvestableIndex), [harvestableIndex]), loading);
  const orders   = useCastApolloQuery<PodOrder>(ordersQuery, 'podOrders', castPodOrder, loading);

  /// Calculations
  const maxPlaceInLine = useMemo(() => (
    listings
      ? Math.max(...listings.map((l) => new BigNumber(l.index).minus(harvestableIndex).toNumber())) 
      : 0
  ), [harvestableIndex, listings]);
  const maxPlotSize = useMemo(() => (
    listings
      ? Math.max(...listings.map((l) => new BigNumber(l.remainingAmount).toNumber()))
      : 0
  ), [listings]);

  return {
    listings,
    orders,
    maxPlaceInLine,
    maxPlotSize,
    harvestableIndex,
    loading,
    error,
  };
};

export default useMarketData;
