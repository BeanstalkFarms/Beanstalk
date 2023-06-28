import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { EventProcessor } from '@beanstalk/sdk';
import useChainId from '~/hooks/chain/useChainId';
import useAccount from '~/hooks/ledger/useAccount';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import useEvents, { GetEventsFn } from '../events2/updater';
import { resetFarmerField } from './actions';
import useSdk from '~/hooks/sdk';

export const useFetchFarmerField = () => {
  /// Helpers
  const dispatch = useDispatch();

  /// Contracts
  const sdk = useSdk();

  /// Data
  const account = useAccount();
  const harvestableIndex = useHarvestableIndex();

  /// Events
  const getQueryFilters = useCallback<GetEventsFn>(
    async (_account, fromBlock, toBlock) =>
      sdk.events.get('field', [
        _account,
        {
          fromBlock, // let cache system choose where to start
          toBlock, // let cache system choose where to end
        },
      ]),
    [sdk.events]
  );

  const [fetchFieldEvents] = useEvents('field', getQueryFilters);
  const initialized = account && fetchFieldEvents && harvestableIndex.gt(0); // harvestedableIndex is initialized to 0

  /// Handlers
  const fetch = useCallback(async () => {
    if (initialized) {
      const allEvents = await fetchFieldEvents();
      if (!allEvents) return;

      const p = new EventProcessor(sdk, account);
      const results = p.ingestAll(allEvents);

      // TODO: fix this
      // dispatch(updateFarmerField(p.parsePlots(harvestableIndex)));
    }
  }, [initialized, fetchFieldEvents, sdk, account]);

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
