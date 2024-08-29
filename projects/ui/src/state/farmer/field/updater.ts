import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useChainId from '~/hooks/chain/useChainId';
import useAccount from '~/hooks/ledger/useAccount';
import useSdk from '~/hooks/sdk';
import { transform } from '~/util/BigNumber';
import {
  resetFarmerField,
  updateFarmerField,
  updateFarmerFieldLoading,
} from './actions';

export const useFetchFarmerField = () => {
  /// Helpers
  const dispatch = useDispatch();

  /// Contracts
  const sdk = useSdk();

  /// Data
  const account = useAccount();

  /// Handlers
  const fetch = useCallback(async () => {
    if (account) {
      const data = await sdk.field.getParsedPlotsFromAccount(account);
      if (!data) return;

      const transformMap = (map: typeof data.plots) => {
        const entries = [...map.entries()];
        return entries.map(([key, amount]) => [
          key,
          transform(amount, 'bnjs', sdk.tokens.PODS),
        ]);
      };

      dispatch(
        updateFarmerField({
          pods: transform(data.pods, 'bnjs', sdk.tokens.PODS),
          harvestablePods: transform(
            data.harvestablePods,
            'bnjs',
            sdk.tokens.PODS
          ),
          plots: Object.fromEntries(transformMap(data.plots)),
          harvestablePlots: Object.fromEntries(
            transformMap(data.harvestablePlots)
          ),
        })
      );
    }
  }, [sdk, account, dispatch]);

  const clear = useCallback(() => {
    console.debug('[farmer/silo/useFarmerField] CLEAR');
    dispatch(resetFarmerField());
  }, [dispatch]);

  return [fetch, true, clear] as const;
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
