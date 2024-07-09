import BigNumber from 'bignumber.js';
import { useCallback, useEffect, useState } from 'react';
import { AllPodListingsQuery, AllPodOrdersQuery, MarketStatus, useAllPodListingsLazyQuery, useAllPodOrdersLazyQuery } from '~/generated/graphql';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import {
  castPodListing,
  castPodOrder,
  PodListing,
  PodOrder,
} from '~/state/farmer/market';
import useSdk from '../sdk';

const MIN_POD_AMOUNT = 1;

const useMarketData = () => {

  const harvestableIndex = useHarvestableIndex();
  const sdk = useSdk();

  /// status
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [listings, setListings] = useState<PodListing[] | undefined>();
  const [orders, setOrders] = useState<PodOrder[] | undefined>();

  const [maxPlaceInLine, setMaxPlaceInLine] = useState<number>(0);
  const [maxPlotSize, setMaxPlotSize] = useState<number>(0);

  /// Queries
  const [getListings] = useAllPodListingsLazyQuery();
  const [getOrders] = useAllPodOrdersLazyQuery();

  const _fetch = useCallback(
    async() => {
      const _listings: AllPodListingsQuery["podListings"] = [];
      const _orders: AllPodOrdersQuery["podOrders"]  = [];

      let listingsOutputLength = 0;
      let listingsQueryLoops = 1;
      let ordersOutputLength = 0;
      let ordersQueryLoops = 1;

      const harvestableIndexFormatted = 
        harvestableIndex.multipliedBy(new BigNumber(10).pow(sdk.tokens.BEAN.decimals)).toString();
  
      try {
        setLoading(true);
        setError(false);    
        do {
          if (harvestableIndex?.gt(0)) {
            const listings = await getListings({
              variables: { 
                first: 1000,
                skip: (listingsQueryLoops * 1000) - 1000,
                status: MarketStatus.Active,
                maxHarvestableIndex: harvestableIndexFormatted,
              },
              fetchPolicy: 'cache-and-network',
              nextFetchPolicy: 'cache-first',
              notifyOnNetworkStatusChange: true,
            });
            if (listings.data) {
              _listings.push(...listings.data.podListings);
              listingsOutputLength = listings.data.podListings.length;
              listingsQueryLoops += 1;
            };
          };
        } while ( listingsOutputLength === 1000 );
        do {
          const orders = await getOrders({
            variables: { 
              first: 1000,
              skip: (ordersQueryLoops * 1000) - 1000,
              status: MarketStatus.Active 
            },
            fetchPolicy: 'cache-and-network',
            nextFetchPolicy: 'cache-first',
            notifyOnNetworkStatusChange: true,
          });
          if (orders.data) {
            _orders.push(...orders.data.podOrders);
            ordersOutputLength = orders.data.podOrders.length;
            ordersQueryLoops += 1;
          };
        } while ( ordersOutputLength === 1000 );
        const _listingsOutput = _listings.map((listing: any) => castPodListing(listing, harvestableIndex));
        setListings(_listingsOutput);
        const _ordersOutput = _orders.map(castPodOrder).filter((order: any) =>
          order.beanAmountRemaining.gt(MIN_POD_AMOUNT)
        );
        setOrders(_ordersOutput);
        setLoading(false);
      } catch (e) {
        setError(true);
      };
    }, 
  [harvestableIndex]);

  useEffect(() => {
    _fetch();
  }, [harvestableIndex]);

  /// Calculations
  useEffect(() => {
    if (harvestableIndex) {
      const _maxPlaceInLine = listings
        ? Math.max(
            ...listings.map((l) =>
              new BigNumber(l.index).minus(harvestableIndex).toNumber()
            )
          )
        : 0;
      setMaxPlaceInLine(_maxPlaceInLine);
    };
  }, [harvestableIndex, listings]);

  useEffect(() => {
    const _maxPlotSize = listings
      ? Math.max(
          ...listings.map((l) => new BigNumber(l.remainingAmount).toNumber())
        )
      : 0;
    setMaxPlotSize(_maxPlotSize);
  }, [listings]);

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
