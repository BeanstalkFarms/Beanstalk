import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useChainConstant from '~/hooks/chain/useChainConstant';

import { REPLANT_INITIAL_ID } from '~/hooks/beanstalk/useHumidity';
import useChainId from '~/hooks/chain/useChainId';
import { tokenResult } from '~/util';
import useAccount from '~/hooks/ledger/useAccount';
import { castFertilizerBalance } from '~/state/farmer/barn';
import { SPROUTS } from '~/constants/tokens';
import { useFertilizerBalancesLazyQuery } from '~/generated/graphql';
import useSdk from '~/hooks/sdk';
import useChainState from '~/hooks/chain/useChainState';
import { resetFarmerBarn, updateFarmerBarn } from './actions';

export const useFetchFarmerBarn = () => {
  /// Helpers
  const dispatch = useDispatch();
  const replantId = useChainConstant(REPLANT_INITIAL_ID);
  const { isEthereum } = useChainState();
  const account = useAccount();
  const sdk = useSdk();

  /// Contracts
  const [fetchFertBalances] = useFertilizerBalancesLazyQuery();

  const fertContract = sdk.contracts.fertilizer;
  const beanstalk = sdk.contracts.beanstalk;

  const initialized = fertContract && account && !isEthereum;

  /// Handlers
  const fetch = useCallback(async () => {
    if (initialized) {
      console.debug(
        '[farmer/fertilizer/updater] FETCH: ',
        replantId.toString()
      );

      const query = await fetchFertBalances({
        variables: { account },
        fetchPolicy: 'network-only',
      });
      const balances =
        query.data?.fertilizerBalances.map(castFertilizerBalance) || [];
      const idStrings = balances.map((bal) => bal.token.id.toString());

      const [unfertilized, fertilized] = await Promise.all([
        /// How much of each ID is Unfertilized (aka a Sprout)
        beanstalk
          .balanceOfUnfertilized(account, idStrings)
          .then(tokenResult(SPROUTS)),
        /// How much of each ID is Fertilized   (aka a Fertilized Sprout)
        beanstalk
          .balanceOfFertilized(account, idStrings)
          .then(tokenResult(SPROUTS)),
      ] as const);

      console.debug(
        '[farmer/fertilizer/updater] RESULT: balances =',
        balances,
        unfertilized.toString(),
        fertilized.toString()
      );

      dispatch(
        updateFarmerBarn({
          balances,
          unfertilizedSprouts: unfertilized,
          fertilizedSprouts: fertilized,
        })
      );
    }
  }, [dispatch, beanstalk, replantId, initialized, account, fetchFertBalances]);

  const clear = useCallback(() => {
    dispatch(resetFarmerBarn());
  }, [dispatch]);

  return [fetch, Boolean(initialized), clear] as const;
};

const FarmerBarnUpdater = () => {
  const [fetch, initialized, clear] = useFetchFarmerBarn();
  const account = useAccount();
  const chainId = useChainId();

  useEffect(() => {
    clear();
    if (account && initialized) fetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account, chainId, initialized]);

  return null;
};

export default FarmerBarnUpdater;
