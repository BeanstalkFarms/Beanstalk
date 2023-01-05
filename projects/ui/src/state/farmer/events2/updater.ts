import { ethers } from 'ethers';
import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useProvider } from 'wagmi';
import flattenDeep from 'lodash/flattenDeep';
import useChainId from '~/hooks/chain/useChainId';
import { Event } from '~/lib/Beanstalk/EventProcessor';
import useEventCache from '~/hooks/farmer/useEventCache';
import useAccount from '~/hooks/ledger/useAccount';
import { EventCacheName } from '.';
import { ingestEvents } from './actions';

export type GetQueryFilters = (
  /**
   * The Farmer account which we're querying against.
   */
  account: string,
  /**
   * The start block from which to query. If not provided,
   * the query filter should fall back to an appropriately 
   * placed block.
   */
  fromBlockOrBlockhash?: string | number | undefined,
  /**
   * The end block to query up until. If not provided,
   * the query filter should fall back to an appropriately 
   * placed block or block tag (likely 'latest').
   */
  toBlock?: number | undefined,
) => (Promise<ethers.Event[]>)[];

export const reduceEvent = (prev: Event[], e: ethers.Event) => {
  try {
    prev.push({
      event: e.event,
      args: e.args,
      blockNumber: e.blockNumber,
      logIndex: e.logIndex,
      transactionHash: e.transactionHash,
      transactionIndex: e.transactionIndex,
    });
  } catch (err) {
    console.error(`Failed to parse event ${e.event} ${e.transactionHash}`, err, e);
  }
  return prev;
};

export const sortEvents = (a: Event, b: Event) => {
  const diff = a.blockNumber - b.blockNumber;
  if (diff !== 0) return diff;
  return a.logIndex - b.logIndex;
};

/**
 * Design notes (Silo Chad)
 * ------------------------
 * 
 * Try to call a subgraph -> formulate data
 *  - Loop through data as necessary (probably fetching all data for the farmer)
 *  - How to handle the case where we want to paginate? Very tricky with events,
 *    since application state needs to rebuilt from the first event up.
 *   
 * If the subgraph call fails, what next?
 *  1. Silently fall back to on-chain events.
 *  2. Ask the user how they want to proceed.
 *  3. Throw an error and stop trying.
 * 
 * If the on-chain event call works
 *  - Parse the events into the same format
 * 
 * If the on-chain event calls fail
 *  - Stop trying
 * 
 * How to save events:
 *  1 Within each section of state (silo, field, market)
 *    - Requires reducer/actions to handle saving events for each section
 *    - Sections could handle events in different ways if necessary
 *    - Different sections could be loaded from different data sources
 *    - Need to solve overlap problem with events like PlotTransfer which are
 *      required for both the Field and the Marketplace
 *      - Is the marketplace out of scope for event processing? Soon enough it will
 *        be far too large to parse. Check to see which event params are indexed.
 *    
 *  2 In a top level "farmer/events" section that shares all events
 *    - The event processor can loop through all events, so no need to filter before
 *      running it
 *      - How to share the event processor across updaters?
 *        - Will event process work OK if data from different regions is entered
 *          out of order? Ex. I ingest all of the Silo events in order, then do all
 *          of the field events in order. I don't think there's any interdependencies here.
 * 
 * What needs to be saved:
 *  - Array of events
 *    - Each event should be annotated with the last time it was loaded, what RPC address
 *  - Last block queried  
 *    - Defaults to an efficient block (ex. don't start at block 0, start at genesis)
 *      - Most efficient block depends on the event. For ex. after Replant the most efficient
 *        block from which to query silo events is the one at which Silo deposits first begin
 *        getting updated.
 *    - Can refetch from block X to latest block
 *    - How does this tie in with the subgraph?
 *      - If the subgraph fails and we have no events loaded, start all the way at 0
 *      - If the subgraph fails and we have some events loaded, query from the last event
 *        up to the most recent block and process accordingly
 *      - Should we ever bust the event cache for some reason?
 *        - User needs to be able to reset the cache
 *        - User needs to be able to choose whether the cache is saved or not
 *          - If we don't let them save, we should re-investigate using wallet native RPCs for 
 *            loading big data like this. Our poor Alchemy keys will get wrecked.
 *        - Not sure in what instance we'd want to bust the cache due to it being stale, given
 *          that ethereum events are set in stone and are processed sequentially to rebuild state.
 *          However we certainly need to let the user switch between wallets or networks.
 *  - Last updated at timestamp
 *  - The data source that last worked
 *    - Even if there are events loaded, we should know whether the visible data came from events or subgraph
 */

export default function useEvents(cacheName: EventCacheName, getQueryFilters: GetQueryFilters) {
  const dispatch = useDispatch();
  const chainId = useChainId();
  const provider = useProvider();
  const account = useAccount();
  const cache = useEventCache(cacheName);

  /// FIXME: account as parameter or hook?
  const fetch = useCallback(async (_startBlockNumber?: number) => {
    if (!account) return;
    const existingEvents = (cache?.events || []);

    /// If a start block is provided, use it; otherwise fall back
    /// to the most recent block queried in this cache.
    const startBlockNumber = (
      _startBlockNumber
      || (cache?.endBlockNumber && cache.endBlockNumber + 1)
    );

    /// Set a deterministic latest block. This lets us know what range
    /// of blocks have already been queried (even if they don't have
    /// corresponding events). 
    const endBlockNumber = await provider.getBlockNumber();
    
    /// FIXME: edge case where user does two transactions in one block
    if (startBlockNumber && startBlockNumber > endBlockNumber) return existingEvents;

    /// if a starting block isn't provided, getQueryFilters will
    /// fall back to the most efficient block for a given query.
    const filters = getQueryFilters(account, startBlockNumber, endBlockNumber);

    ///
    console.debug(`[useEvents] ${cacheName}: fetching events`, {
      cacheId: cacheName,
      startBlockNumber,
      endBlockNumber,
      filterCount: filters.length,
      cacheEndBlockNumber: cache?.endBlockNumber,
    });

    /// Flatten into single-layer events array.
    const results = await Promise.all(filters); // [[0,1,2],[0,1],...]
    const newEvents = (
      flattenDeep<ethers.Event>(results)
        .reduce<Event[]>(reduceEvent, [])
        .sort(sortEvents)
    ); // [0,0,1,1,2]

    console.debug(`[useEvents] ${cacheName}: fetched ${newEvents.length} new events`);

    dispatch(ingestEvents({
      /// Cache info
      cache: cacheName,
      account,
      chainId,
      /// if startBlockNumber wasn't set, use the earliest block found.
      /// FIXME: handle undefined
      startBlockNumber: startBlockNumber || newEvents[0]?.blockNumber,
      endBlockNumber,
      timestamp: new Date().getTime(),
      events: newEvents,
    }));

    return [
      ...existingEvents,
      ...newEvents,
    ];
  }, [
    dispatch,
    account,
    cache?.endBlockNumber,
    cache?.events,
    cacheName,
    chainId,
    getQueryFilters,
    provider,
  ]);

  return [cache ? fetch : undefined] as const;
}
