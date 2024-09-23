import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import useAccount from '~/hooks/ledger/useAccount';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
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

  useL2OnlyEffect(() => {
    clear();
    if (account && initialized) fetch();
  }, [account, initialized]);

  return null;
};

export default FarmerMarketUpdater;
