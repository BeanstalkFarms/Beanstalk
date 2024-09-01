import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useChainId from '~/hooks/chain/useChainId';
import useAccount from '~/hooks/ledger/useAccount';
import useChainState from '~/hooks/chain/useChainState';
import { resetFarmerMarket } from './actions';

export const useFetchFarmerMarket = () => {
  /// Helpers
  const dispatch = useDispatch();

  /// Handlers
  const fetch = useCallback(async () => {}, []);
  const clear = useCallback(() => {
    console.debug('[farmer/silo/useFarmerMarket] CLEAR');
    dispatch(resetFarmerMarket());
  }, [dispatch]);

  return [fetch, true, clear] as const;
};

// -- Updater

const FarmerMarketUpdater = () => {
  const [fetch, initialized, clear] = useFetchFarmerMarket();
  const account = useAccount();
  const chainId = useChainId();
  const { isEthereum } = useChainState();

  useEffect(() => {
    clear();
    if (account && initialized && !isEthereum) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, chainId, initialized, isEthereum]);

  return null;
};

export default FarmerMarketUpdater;
