import BigNumber from 'bignumber.js';
import { useCallback, useState, useEffect } from 'react';
import keyBy from 'lodash/keyBy';
import {
  HistoricalPodListingsQuery,
  HistoricalPodListingsQueryResult,
  HistoricalPodOrdersQuery,
  HistoricalPodOrdersQueryResult,
  MarketEventsQuery,
  MarketEventsQueryResult,
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
  const [error, setError] = useState<boolean>(false);

  const [podOrders, setPodOrders] = useState<any[]>([]);
  const [podListings, setPodListings] = useState<any[]>([]);
  const [markEvents, setMarketEvents] = useState<any[]>([]);

  /// Queries
  const [getMarketEvents] = useMarketEventsLazyQuery({
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
    variables: {
      events_first: 1000,
      events_timestamp_lt: MAX_TIMESTAMP,
    },
  });

  const [getPodOrders] = useHistoricalPodOrdersLazyQuery({
    fetchPolicy: 'network-only',
  });

  const [getPodListings] = useHistoricalPodListingsLazyQuery({
    fetchPolicy: 'network-only',
  });

  // fetch
  const _fetch = useCallback(
    async () => {
      setLoading(true);
      setPage((p) => p + 1);

      let lastOutputLength = 0;
      let lastTimestamp = MAX_TIMESTAMP;
      
      const podMarketEvents: MarketEventsQuery["marketEvents"] = [];
      const podOrdersHistoryIDs: HistoricalPodOrdersQuery["podOrders"] = [];
      const podListingsHistoryIDs: HistoricalPodListingsQuery["podListings"] = [];

      try {
        do {
          const events = await getMarketEvents({
            variables: { events_first: 1000, events_timestamp_lt: lastTimestamp },
          });
          if (events.data?.marketEvents.length) {
            podMarketEvents.push(...events.data.marketEvents);
            lastOutputLength = events.data.marketEvents.length;
            lastTimestamp = events.data.marketEvents[events.data.marketEvents.length - 1].createdAt;
          };
        } while ( lastOutputLength === 1000 );
        setError(false);
      } catch (e) {
        setError(true);
      }
 
      // run join query if we loaded any market events
      if (podMarketEvents.length > 0) {
        setMarketEvents(podMarketEvents);
        // find IDs to join against
        const [orderIDs, listingIDs] = podMarketEvents.reduce(
          (prev: any, curr: any) => {
            if (
              curr.__typename === 'PodOrderFilled' ||
              curr.__typename === 'PodOrderCancelled'
            ) {
              prev[0].push(curr.historyID);
            } else if (
              curr.__typename === 'PodListingFilled' ||
              curr.__typename === 'PodListingCancelled'
            ) {
              prev[1].push(curr.historyID);
            }
            return prev;
          },
          [[], []]
        );

        // lookup all of the orders and listings needed to join to the above query

        const promises: Promise<any>[] = [];

        const podOrdersRequests = Math.ceil(orderIDs.length / 1000);
        const podListingsRequests = Math.ceil(listingIDs.length / 1000);

        try {
          for (let i = 0; i < podOrdersRequests; i += 1) {
            const startPosition = i * 1000;
            const amountToSplice = i !== podOrdersRequests - 1 ? 1000 : orderIDs.length % 1000;
            const selectedPodOrders = orderIDs.slice(startPosition, startPosition + amountToSplice);
            promises.push(
              getPodOrders({
                variables: {
                  historyIDs: selectedPodOrders
                }
              }).then(
                (r) => {
                  if (r.data && r.data.podOrders.length) {
                    podOrdersHistoryIDs.push(...r.data.podOrders);
                  };
                }
              )
            );
          };

          for (let i = 0; i < podListingsRequests; i += 1) {
            const startPosition = i * 1000;
            const amountToSplice = i !== podListingsRequests - 1 ? 1000 : listingIDs.length % 1000;
            const selectedPodListings = listingIDs.slice(startPosition, startPosition + amountToSplice);
            promises.push(
              getPodListings({
                variables: {
                  historyIDs: selectedPodListings
                }
              })
              .then(
                (r) => {
                  if (r.data && r.data.podListings.length) {
                    podListingsHistoryIDs.push(...r.data.podListings)
                  };
                }
              )
            );
          };
          setError(false);
        } catch (e) {
          setError(true);
        };


        await Promise.all(promises);
        setPodOrders(podOrdersHistoryIDs);
        setPodListings(podListingsHistoryIDs);
      }

      setLoading(false);
    },
    [getMarketEvents, getPodListings, getPodOrders]
  );


  // when all queries finish, process data

  useEffect(() => {
    const events = markEvents;
    if (!loading && events?.length) {
      const podOrdersById = keyBy(podOrders, 'historyID');
      const podListingsById = keyBy(podListings, 'historyID');

      // FIXME:
      // This duplicates logic from `castPodListing` and `castPodOrder`.
      // The `marketplaceEvent` entity contains partial information about
      // Orders and Listings during Creation, but NO information during cancellations
      // and fills. In both cases, casting doesn't work because of missing data.
      const parseEvent = (e: typeof events[number]) => {
        switch (e.__typename) {
          case 'PodOrderCreated': {
            const pricePerPod = toTokenUnitsBN(e.pricePerPod, BEAN[1].decimals);
            const amount = toTokenUnitsBN(e.amount, BEAN[1].decimals);
            const placeInLine = toTokenUnitsBN(
              e.maxPlaceInLine,
              BEAN[1].decimals
            );
            // HOTFIX: amountPods is using the legacy bean amount format for these events
            const amountPods = amount;
            const amountBeans = amount.multipliedBy(pricePerPod);
            return <MarketEvent>{
              id: 'unknown',
              eventId: e.id,
              hash: e.hash,
              type: 'order' as const,
              action: 'create' as const,
              amountPods: amountPods,
              placeInLine: placeInLine,
              pricePerPod: pricePerPod,
              amountBeans: amountBeans,
              amountUSD: getUSD(BEAN[1], amountBeans),
              createdAt: e.createdAt,
            };
          }
          case 'PodOrderCancelled': {
            // HOTFIX: Fixes edge case where PodOrderCancelled is emitted for an order that doesn't actually exist.
            const podOrder = podOrdersById[e.historyID];

            if (!e.historyID || !podOrder) return null;
            const beanAmount = toTokenUnitsBN(
              podOrder.beanAmount || 0,
              BEAN[1].decimals
            );
            const pricePerPod = toTokenUnitsBN(
              new BigNumber(podOrder.pricePerPod || 0),
              BEAN[1].decimals
            );
            const podAmount =
              beanAmount && pricePerPod
                ? beanAmount.multipliedBy(pricePerPod)
                : undefined;

            return <MarketEvent>{
              id: podOrder.id,
              eventId: e.id,
              hash: e.hash,
              type: 'order' as const,
              action: 'cancel' as const,
              amountPods: podAmount,
              placeInLine: toTokenUnitsBN(
                podOrder?.maxPlaceInLine,
                BEAN[1].decimals
              ),
              pricePerPod: pricePerPod,
              amountBeans: beanAmount,
              amountUSD: beanAmount ? getUSD(BEAN[1], beanAmount) : undefined,
              createdAt: e.createdAt,
            };
          }
          case 'PodOrderFilled': {
            // HOTFIX: Fixes edge case where PodOrderCancelled is emitted for an order that doesn't actually exist.
            const podOrder = podOrdersById[e.historyID];
            if (!e.historyID || !podOrder) return null;

            const pricePerPod = toTokenUnitsBN(
              new BigNumber(podOrder.pricePerPod || 0),
              BEAN[1].decimals
            );
            const podAmountFilled = toTokenUnitsBN(
              e.amount,
              BEAN[1].decimals
            );
            const totalBeans = podAmountFilled.multipliedBy(pricePerPod).dp(6);
            return <MarketEvent>{
              id: podOrder.id,
              eventId: e.id,
              hash: e.hash,
              type: 'order' as const,
              action: 'fill' as const,
              amountPods: podAmountFilled,
              placeInLine: toTokenUnitsBN(
                new BigNumber(e.placeInLine),
                BEAN[1].decimals
              ),
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
            return <MarketEvent>{
              id: e.historyID.split('-')[1],
              eventId: e.id,
              hash: e.hash,
              type: 'listing' as const,
              action: 'create' as const,
              amountPods: numPods,
              placeInLine: toTokenUnitsBN(
                new BigNumber(e.placeInLine),
                BEAN[1].decimals
              ),
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
            const pricePerPod = toTokenUnitsBN(
              new BigNumber(podListing.pricePerPod || 0),
              BEAN[1].decimals
            );
            const totalBeans = numPods.multipliedBy(pricePerPod).dp(6);
            return <MarketEvent>{
              id: e.historyID.split('-')[1],
              eventId: e.id,
              hash: e.hash,
              type: 'listing' as const,
              action: 'cancel' as const,
              amountPods: numPods,
              placeInLine: toTokenUnitsBN(
                new BigNumber(e.placeInLine),
                BEAN[1].decimals
              ),
              pricePerPod: pricePerPod,
              amountBeans: totalBeans,
              amountUSD: getUSD(BEAN[1], totalBeans),
              createdAt: e.createdAt,
            };
          }
          case 'PodListingFilled': {
            const podListing = podListingsById[e.historyID];
            if (!e.historyID || !podListing) return null;

            const numPodsFilled = toTokenUnitsBN(
              podListing?.filledAmount,
              BEAN[1].decimals
            );
            const pricePerPod = toTokenUnitsBN(
              new BigNumber(podListing?.pricePerPod || 0),
              BEAN[1].decimals
            );
            const totalBeans = numPodsFilled.multipliedBy(pricePerPod);
            return <MarketEvent>{
              id: e.historyID.split('-')[1],
              eventId: e.id,
              hash: e.hash,
              type: 'listing' as const,
              action: 'fill' as const,
              amountPods: numPodsFilled,
              placeInLine: toTokenUnitsBN(
                new BigNumber(e.placeInLine),
                BEAN[1].decimals
              ),
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

      const _data: MarketEvent[] = [];
      for (let i = 0; i < events.length; i += 1) {
        const parsed = parseEvent(events[i]);
        if (parsed) _data.push(parsed);
      }

      setData(_data);
    }
  }, [
    getUSD,
    harvestableIndex,
    loading,
    podOrders,
    podListings,
    markEvents,
    page,
  ]);

  // kick things off
  useEffect(() => {
    _fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    data,
    harvestableIndex,
    loading,
    error,
    page,
  };
};

export default useMarketActivityData;
