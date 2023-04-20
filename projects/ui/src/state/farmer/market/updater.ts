import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useChainId from '~/hooks/chain/useChainId';
import useBlocks from '~/hooks/ledger/useBlocks';
import useAccount from '~/hooks/ledger/useAccount';
import useWhitelist from '~/hooks/beanstalk/useWhitelist';
import useSeason from '~/hooks/beanstalk/useSeason';
import { EventCacheName } from '../events2';
import useEvents, { GetQueryFilters } from '../events2/updater';
import { resetFarmerMarket } from './actions';

export const useFetchFarmerMarket = () => {
  /// Helpers
  const dispatch  = useDispatch();

  /// Contracts
  const beanstalk = useBeanstalkContract();

  /// Data
  const account   = useAccount();
  const blocks    = useBlocks();
  const whitelist = useWhitelist();
  const season    = useSeason();

  /// Events
  const getQueryFilters = useCallback<GetQueryFilters>((
    _account,
    fromBlock,
    toBlock,
  ) => [
    beanstalk.queryFilter(
      beanstalk.filters.PodListingCreated(_account),
      fromBlock || blocks.BIP10_COMMITTED_BLOCK,
      toBlock   || 'latest',
    ),
    beanstalk.queryFilter(
      beanstalk.filters['PodListingCancelled(address,uint256)'](_account),
      fromBlock || blocks.BIP10_COMMITTED_BLOCK,
      toBlock   || 'latest',
    ),
    // this account had a listing filled
    beanstalk.queryFilter(
      beanstalk.filters.PodListingFilled(null, _account), // to
      fromBlock || blocks.BIP10_COMMITTED_BLOCK,
      toBlock   || 'latest',
    ),
    beanstalk.queryFilter(
      beanstalk.filters.PodOrderCreated(_account), 
      fromBlock || blocks.BIP10_COMMITTED_BLOCK,
      toBlock   || 'latest',
    ),
    beanstalk.queryFilter(
      beanstalk.filters.PodOrderCancelled(_account), 
      fromBlock || blocks.BIP10_COMMITTED_BLOCK,
      toBlock   || 'latest',
    ),
    beanstalk.queryFilter(
      beanstalk.filters.PodOrderFilled(null, _account), // to
      fromBlock || blocks.BIP10_COMMITTED_BLOCK,
      toBlock   || 'latest',
    ),
  ], [
    blocks,
    beanstalk,
  ]);
  
  const [fetchMarketEvents] = useEvents(EventCacheName.MARKET, getQueryFilters);

  const initialized = (
    account
    && fetchMarketEvents
  );

  /// Handlers
  const fetch = useCallback(async () => {
    // if (initialized) {
    //   const allEvents = await fetchMarketEvents();
    //   if (!allEvents) return;
    //   const p = new EventProcessor(account, { season, whitelist });
    //   p.ingestAll(allEvents);

    //   // Update Field
    //   dispatch(updateFarmerMarket({
    //     listings: p.listings,
    //     orders: p.orders,
    //   }));
    // }
  }, []);
  
  const clear = useCallback(() => {
    console.debug('[farmer/silo/useFarmerSilo] CLEAR');
    dispatch(resetFarmerMarket());
  }, [dispatch]);

  return [fetch, Boolean(initialized), clear] as const;
};

// -- Updater

const FarmerMarketUpdater = () => {
  const [fetch, initialized, clear] = useFetchFarmerMarket();
  const account = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    clear();
    if (account && initialized) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, chainId, initialized]);

  return null;
};

export default FarmerMarketUpdater;
