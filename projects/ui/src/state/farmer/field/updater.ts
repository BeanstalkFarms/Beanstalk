import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useChainId from '~/hooks/chain/useChainId';
import useAccount from '~/hooks/ledger/useAccount';
import useSdk from '~/hooks/sdk';
import { transform } from '~/util/BigNumber';
import useChainState from '~/hooks/chain/useChainState';
import BigNumber from 'bignumber.js';
import {
  resetFarmerField,
  updateFarmerField,
  updateFarmerFieldLoading,
} from './actions';

export const useFetchFarmerField = () => {
  const { isEthereum } = useChainState();
  const account = useAccount();
  const sdk = useSdk();
  const dispatch = useDispatch();

  /// Handlers
  const fetch = useCallback(async () => {
    if (account && !isEthereum) {
      const data = await sdk.field.getParsedPlotsFromAccount(account);
      if (!data) return;

      const transformMap = (map: typeof data.plots) => {
        const entries = [...map.entries()];
        return entries.map(([key, amount]) => [
          sdk.tokens.PODS.fromBlockchain(key).toHuman(),
          transform(amount, 'bnjs', sdk.tokens.PODS),
        ]);
      };

      dispatch(
        updateFarmerField({
          pods: new BigNumber(data.pods.toHuman()),
          harvestablePods: new BigNumber(data.harvestablePods.toHuman()),
          plots: Object.fromEntries(transformMap(data.plots)),
          harvestablePlots: Object.fromEntries(
            transformMap(data.harvestablePlots)
          ),
        })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sdk, account, isEthereum]);

  const clear = useCallback(() => {
    console.debug('[farmer/silo/useFarmerField] CLEAR');
    dispatch(resetFarmerField());
  }, [dispatch]);

  return [fetch, clear] as const;
};

// -- Updater

const FarmerFieldUpdater = () => {
  const [fetch, clear] = useFetchFarmerField();
  const dispatch = useDispatch();
  const account = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    clear();

    if (account) {
      dispatch(updateFarmerFieldLoading(true));
      fetch()
        .catch((err) => {
          if ((err as Error).message.includes('limit the query')) {
            console.log(
              'Failed to fetch Field events: RPC query limit exceeded'
            );
          } else {
            console.error(
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
  }, [account, chainId]);

  return null;
};

export default FarmerFieldUpdater;
