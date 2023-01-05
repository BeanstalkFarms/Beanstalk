import BigNumber from 'bignumber.js';
import { useCallback, useState, useEffect } from 'react';
import keyBy from 'lodash/keyBy';
import {
  useHistoricalPodListingsLazyQuery,
  useHistoricalPodOrdersLazyQuery,
  useMarketEventsLazyQuery,
} from '~/generated/graphql';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import { toTokenUnitsBN } from '~/util';
import { BEAN } from '~/constants/tokens';
import useSiloTokenToFiat from '~/hooks/beanstalk/useSiloTokenToFiat';

export type MarketEvent = {
  // the entity that the event referred to
  id: string;
  // the individual event id, usually includes txn hash
  eventId: string;
  type: 'listing' | 'order';  
  action: 'create' | 'cancel' | 'fill';
  amountPods: BigNumber;
  placeInLine: BigNumber;
  pricePerPod: BigNumber;
  amountBeans: BigNumber;
  amountUSD: BigNumber;
  createdAt: number;
  hash: string;
};

export const QUERY_AMOUNT = 500;
export const MAX_TIMESTAMP = '9999999999999'; // 166 455 351 3803

/**
 * Load historical market activity. This merges raw event date from `eventsQuery`
 * with parsed data from `ordersQuery` and `listingsQuery`.
 */
const useMarketActivityData = () => {
  /// Beanstalk data
  const harvestableIndex = useHarvestableIndex();
  const getUSD = useSiloTokenToFiat();

  ///
  const [page, setPage] = useState<number>(0);
  const [data, setData] = useState<MarketEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  /// Queries
  const [getMarketEvents, marketEventsQuery] = useMarketEventsLazyQuery({
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
    variables: {
      events_first: QUERY_AMOUNT,
      events_timestamp_lt: MAX_TIMESTAMP,
    },
  });
  const [getPodOrders, podOrdersQuery] = useHistoricalPodOrdersLazyQuery({
    fetchPolicy: 'network-only'
  });
  const [getPodListings, podListingsQuery] = useHistoricalPodListingsLazyQuery({
    fetchPolicy: 'network-only'
  });

  const error = (
    marketEventsQuery.error
    || podOrdersQuery.error
    || podListingsQuery.error
  );

  // fetch 
  const _fetch = useCallback(async (first: number, after: string) => {
    setLoading(true);
    setPage((p) => p + 1);
    const result = await getMarketEvents({ variables: { events_first: first, events_timestamp_lt: after } });

    // run join query if we loaded more market events
    if (result.data?.marketEvents.length) {
      // find IDs to join against
      const [orderIDs, listingIDs] = result.data.marketEvents.reduce<[string[], string[]]>((prev, curr) => {
        if (curr.__typename === 'PodOrderFilled' || curr.__typename === 'PodOrderCancelled') {
          prev[0].push(curr.historyID);
        } else if (curr.__typename === 'PodListingFilled' || curr.__typename === 'PodListingCancelled') {
          prev[1].push(curr.historyID);
        }
        return prev;
      }, [[], []]);

      // lookup all of the orders and listings needed to join to the above query
      await Promise.all([
        getPodOrders({
          variables: { 
            historyIDs: orderIDs,
          }
        }),
        getPodListings({
          variables: { 
            historyIDs: listingIDs,
          }
        }),
      ]);
    }

    setLoading(false);
  }, [getMarketEvents, getPodListings, getPodOrders]);

  // look up the next set of marketplaceEvents using the last known timestamp
  const fetchMoreData = useCallback(async () => {
    const first = QUERY_AMOUNT;
    const after = (
      marketEventsQuery.data?.marketEvents?.length
        ? marketEventsQuery.data?.marketEvents[marketEventsQuery.data?.marketEvents.length - 1].createdAt
        : MAX_TIMESTAMP
    );
    console.debug('Fetch more: ', first, after);
    await _fetch(first, after);
  }, [_fetch, marketEventsQuery.data?.marketEvents]);

  // when all queries finish, process data
  useEffect(() => {
    const events = marketEventsQuery.data?.marketEvents;
    if (!loading && events?.length) {
      const podOrdersById = keyBy(podOrdersQuery.data?.podOrders, 'historyID');
      const podListingsById = keyBy(podListingsQuery.data?.podListings, 'historyID');

      // FIXME:
      // This duplicates logic from `castPodListing` and `castPodOrder`.
      // The `marketplaceEvent` entity contains partial information about
      // Orders and Listings during Creation, but NO information during cancellations
      // and fills. In both cases, casting doesn't work because of missing data. 
      const parseEvent = (e: typeof events[number]) => {
        switch (e.__typename) {
          case 'PodOrderCreated': {
            const pricePerPod = toTokenUnitsBN(e.pricePerPod, BEAN[1].decimals);
            const amountPods = toTokenUnitsBN(e.amount, BEAN[1].decimals);
            const placeInLine = toTokenUnitsBN(e.maxPlaceInLine, BEAN[1].decimals);        
            const totalBeans = amountPods.multipliedBy(pricePerPod);
            return <MarketEvent>{
              id: 'unknown',
              eventId: e.id,
              hash: e.hash,
              type: 'order' as const,
              action: 'create' as const,
              amountPods: amountPods,
              placeInLine: placeInLine,
              pricePerPod: pricePerPod,
              amountBeans: totalBeans,
              amountUSD: getUSD(BEAN[1], totalBeans),
              createdAt: e.createdAt,
            };
          }
          case 'PodOrderCancelled': {
            // HOTFIX: Fixes edge case where PodOrderCancelled is emitted for an order that doesn't actually exist.
            const podOrder = podOrdersById[e.historyID];
            if (!e.historyID || !podOrder) return null;

            const podAmount = toTokenUnitsBN(podOrder.podAmount || 0, BEAN[1].decimals);
            const pricePerPod = toTokenUnitsBN(new BigNumber(podOrder.pricePerPod || 0), BEAN[1].decimals);
            const totalBeans = podAmount && pricePerPod
              ? podAmount.multipliedBy(pricePerPod)
              : undefined;

            console.log('PodOrderCancelled', podOrder);
              
            return <MarketEvent>{
              id: podOrder.id,
              eventId: e.id,
              hash: e.hash,
              type: 'order' as const,
              action: 'cancel' as const,
              amountPods: toTokenUnitsBN(podOrder?.podAmount, BEAN[1].decimals),
              placeInLine: toTokenUnitsBN(podOrder?.maxPlaceInLine, BEAN[1].decimals),
              pricePerPod: toTokenUnitsBN(new BigNumber(podOrder?.pricePerPod || 0), BEAN[1].decimals),
              amountBeans: totalBeans,
              amountUSD: totalBeans ? getUSD(BEAN[1], totalBeans) : undefined,
              createdAt: e.createdAt,
            };
          }
          case 'PodOrderFilled': {
            // HOTFIX: Fixes edge case where PodOrderCancelled is emitted for an order that doesn't actually exist.
            const podOrder = podOrdersById[e.historyID];
            if (!e.historyID || !podOrder) return null;

            const pricePerPod = toTokenUnitsBN(new BigNumber(podOrder.pricePerPod || 0), BEAN[1].decimals);
            const podAmountFilled = toTokenUnitsBN(podOrder.podAmountFilled, BEAN[1].decimals);
            const totalBeans =  getUSD(BEAN[1], podAmountFilled.multipliedBy(pricePerPod));
            return <MarketEvent> {
              id: podOrder.id,
              eventId: e.id,
              hash: e.hash,
              type: 'order' as const,
              action: 'fill' as const,
              amountPods: podAmountFilled,
              placeInLine: toTokenUnitsBN(new BigNumber(e.index), BEAN[1].decimals).minus(harvestableIndex),
              pricePerPod: pricePerPod,
              amountBeans: totalBeans,
              amountUSD: getUSD(BEAN[1], totalBeans),
              createdAt: e.createdAt,
            };
          }
          case 'PodListingCreated': {
            const numPods = toTokenUnitsBN(e.amount, BEAN[1].decimals);
            const pricePerPod = toTokenUnitsBN(e.pricePerPod, BEAN[1].decimals);
            const totalBeans = numPods.multipliedBy(pricePerPod);
            return <MarketEvent> {
              id: e.historyID.split('-')[1],
              eventId: e.id,
              hash: e.hash,
              type: 'listing' as const,
              action: 'create' as const,
              amountPods: numPods,
              placeInLine: toTokenUnitsBN(e.index, BEAN[1].decimals).minus(harvestableIndex),
              pricePerPod: pricePerPod,
              amountBeans: totalBeans,
              amountUSD: getUSD(BEAN[1], totalBeans),
              createdAt: e.createdAt,
            };
          }
          case 'PodListingCancelled': {
            const podListing = podListingsById[e.historyID];
            if (!e.historyID || !podListing) return null;

            const numPods = toTokenUnitsBN(podListing.amount, BEAN[1].decimals);
            const pricePerPod = toTokenUnitsBN(new BigNumber(podListing.pricePerPod || 0), BEAN[1].decimals);
            const totalBeans = numPods.multipliedBy(pricePerPod);

            return <MarketEvent> {
              id: e.historyID.split('-')[1],
              eventId: e.id,
              hash: e.hash,
              type: 'listing' as const,
              action: 'cancel' as const,
              amountPods: numPods,
              placeInLine: toTokenUnitsBN(podListing?.index, BEAN[1].decimals).minus(harvestableIndex),
              pricePerPod: pricePerPod,
              amountBeans: totalBeans,
              amountUSD: getUSD(BEAN[1], totalBeans),
              createdAt: e.createdAt,
            };
          }
          case 'PodListingFilled': {
            const podListing = podListingsById[e.historyID];
            if (!e.historyID || !podListing) return null;

            const numPodsFilled = toTokenUnitsBN(podListing?.filledAmount, BEAN[1].decimals);
            const pricePerPod = toTokenUnitsBN(new BigNumber(podListing?.pricePerPod || 0), BEAN[1].decimals);
            const totalBeans = numPodsFilled.multipliedBy(pricePerPod);
            return <MarketEvent> {
              id: e.historyID.split('-')[1],
              eventId: e.id,
              hash: e.hash,
              type: 'listing' as const,
              action: 'fill' as const,
              amountPods: numPodsFilled,
              placeInLine: toTokenUnitsBN(podListing?.index, BEAN[1].decimals).minus(harvestableIndex),
              pricePerPod: pricePerPod,
              amountBeans: totalBeans,
              amountUSD: getUSD(BEAN[1], totalBeans),
              createdAt: e.createdAt,
            };
          }
          default: {
            return null;
          }
        }
      };

      const _data : MarketEvent[] = [];
      const _max = Math.min(events.length, QUERY_AMOUNT * page);
      for (let i = 0; i < _max; i += 1)  {
        const parsed = parseEvent(events[i]);
        if (parsed) _data.push(parsed);
      }

      setData(_data);
    }
  }, [
    getUSD, 
    harvestableIndex, 
    loading, 
    marketEventsQuery.data, 
    podListingsQuery.data, 
    podOrdersQuery.data,
    page,
  ]);

  // kick things off
  useEffect(() => {
    _fetch(QUERY_AMOUNT, MAX_TIMESTAMP);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    data,
    harvestableIndex,
    loading,
    error,
    fetchMoreData,
    page
  };
};

export default useMarketActivityData;
