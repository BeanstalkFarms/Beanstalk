import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { EventProcessor } from '@beanstalk/sdk';
import useChainId from '~/hooks/chain/useChainId';
import useAccount from '~/hooks/ledger/useAccount';
import useHarvestableIndex from '~/hooks/beanstalk/useHarvestableIndex';
import useEvents, { GetEventsFn } from '../events2/updater';
import {
  resetFarmerField,
  updateFarmerField,
  updateFarmerFieldLoading,
} from './actions';
import useSdk from '~/hooks/sdk';
import { transform } from '~/util/BigNumber';
import { FarmerField } from '~/state/farmer/field';

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

      const processor = new EventProcessor(sdk, account);
      processor.ingestAll(allEvents);
      const result = processor.parsePlots({
        harvestableIndex: sdk.tokens.PODS.fromHuman(
          harvestableIndex.toString()
        ).toBigNumber(), // ethers.BigNumber
      });

      // TEMP: Wrangle `result` into our internal state's existing format
      // Tested by manual validation.
      const plots: FarmerField['plots'] = {};
      const harvestablePlots: FarmerField['harvestablePlots'] = {};
      result.plots.forEach((plot, indexStr) => {
        plots[sdk.tokens.PODS.fromBlockchain(indexStr).toHuman()] = transform(
          plot,
          'bnjs',
          sdk.tokens.PODS
        );
      });
      result.harvestablePlots.forEach((plot, indexStr) => {
        harvestablePlots[sdk.tokens.PODS.fromBlockchain(indexStr).toHuman()] =
          transform(plot, 'bnjs', sdk.tokens.PODS);
      });

      dispatch(
        updateFarmerField({
          pods: transform(result.pods, 'bnjs', sdk.tokens.PODS),
          harvestablePods: transform(
            result.harvestablePods,
            'bnjs',
            sdk.tokens.PODS
          ),
          plots,
          harvestablePlots,
        })
      );
    }
  }, [initialized, fetchFieldEvents, sdk, account, dispatch, harvestableIndex]);

  const clear = useCallback(() => {
    console.debug('[farmer/silo/useFarmerField] CLEAR');
    dispatch(resetFarmerField());
  }, [dispatch]);

  return [fetch, Boolean(initialized), clear] as const;
};

// -- Updater

const FarmerFieldUpdater = () => {
  const [fetch, initialized, clear] = useFetchFarmerField();
  const dispatch = useDispatch();
  const account = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    clear();

    if (account && initialized) {
      dispatch(updateFarmerFieldLoading(true));
      fetch()
        .catch((err) => {
          if ((err as Error).message.includes('limit the query')) {
            console.log(
              'Failed to fetch Field events: RPC query limit exceeded'
            );
          } else {
            console.log(
              'Failed to fetch Field events: ',
              (err as Error).message
            );
          }
        })
        .finally(() => {
          dispatch(updateFarmerFieldLoading(false));
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, chainId, initialized]);

  return null;
};

export default FarmerFieldUpdater;
