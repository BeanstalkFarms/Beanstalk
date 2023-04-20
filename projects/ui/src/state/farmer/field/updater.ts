import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useChainId from '~/hooks/chain/useChainId';
import useBlocks from '~/hooks/ledger/useBlocks';
import useAccount from '~/hooks/ledger/useAccount';
import EventProcessor from '~/lib/Beanstalk/EventProcessor';
import useWhitelist from '~/hooks/beanstalk/useWhitelist';
import useSeason from '~/hooks/beanstalk/useSeason';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import { EventCacheName } from '../events2';
import useEvents, { GetQueryFilters } from '../events2/updater';
import { updateFarmerField, resetFarmerField } from './actions';

export const useFetchFarmerField = () => {
  /// Helpers
  const dispatch  = useDispatch();

  /// Contracts
  const beanstalk = useBeanstalkContract();

  /// Data
  const account   = useAccount();
  const blocks    = useBlocks();
  const whitelist = useWhitelist();
  const season    = useSeason();
  const harvestableIndex = useHarvestableIndex();

  /// Events
  const getQueryFilters = useCallback<GetQueryFilters>((
    _account,
    fromBlock,
    toBlock,
  ) => [
    beanstalk.queryFilter(
      beanstalk.filters['Sow(address,uint256,uint256,uint256)'](_account),
      fromBlock || blocks.BEANSTALK_GENESIS_BLOCK,
      toBlock   || 'latest',
    ),
    beanstalk.queryFilter(
      beanstalk.filters.Harvest(_account),
      fromBlock || blocks.BEANSTALK_GENESIS_BLOCK,
      toBlock   || 'latest',
    ),
    beanstalk.queryFilter(
      beanstalk.filters.PlotTransfer(_account, null), // from
      fromBlock || blocks.BEANSTALK_GENESIS_BLOCK,
      toBlock   || 'latest',
    ),
    beanstalk.queryFilter(
      beanstalk.filters.PlotTransfer(null, _account), // to
      fromBlock || blocks.BEANSTALK_GENESIS_BLOCK,
      toBlock   || 'latest',
    ),
  ], [
    blocks,
    beanstalk,
  ]);
  
  const [fetchFieldEvents] = useEvents(EventCacheName.FIELD, getQueryFilters);

  const initialized = (
    account
    && fetchFieldEvents
    && harvestableIndex.gt(0) // harvestedableIndex is initialized to 0
  );

  /// Handlers
  const fetch = useCallback(async () => {
    if (initialized) {
      const allEvents = await fetchFieldEvents();
      if (!allEvents) return;

      const p = new EventProcessor(account, { season, whitelist });
      p.ingestAll(allEvents);

      dispatch(updateFarmerField(
        p.parsePlots(harvestableIndex)
      ));
    }
  }, [
    dispatch,
    fetchFieldEvents,
    initialized,
    // v2
    season,
    whitelist,
    account,
    harvestableIndex
  ]);
  
  const clear = useCallback(() => {
    console.debug('[farmer/silo/useFarmerSilo] CLEAR');
    dispatch(resetFarmerField());
  }, [dispatch]);

  return [fetch, Boolean(initialized), clear] as const;
};

// -- Updater

const FarmerFieldUpdater = () => {
  const [fetch, initialized, clear] = useFetchFarmerField();
  const account = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    clear();
    if (account && initialized) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, chainId, initialized]);

  return null;
};

export default FarmerFieldUpdater;
