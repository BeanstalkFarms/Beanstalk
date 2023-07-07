import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import BigNumberJS from 'bignumber.js';
import {
  BEAN_TO_SEEDS,
  BEAN_TO_STALK,
  ONE_BN,
  TokenMap,
  ZERO_BN,
} from '~/constants';
import { bigNumberResult } from '~/util/Ledger';
import { tokenResult, transform } from '~/util';
import { BEAN, STALK } from '~/constants/tokens';
import { useGetChainConstant } from '~/hooks/chain/useChainConstant';
import { resetBeanstalkSilo, updateBeanstalkSilo } from './actions';
import { BeanstalkSiloBalance } from './index';
import useSdk from '~/hooks/sdk';

export const useFetchBeanstalkSilo = () => {
  const dispatch = useDispatch();
  const sdk = useSdk();

  ///
  const getChainConstant = useGetChainConstant();
  const Bean = getChainConstant(BEAN);

  /// Handlers
  const fetch = useCallback(async () => {
    const [
      // 0
      stalkTotal,
      bdvTotal,
      rootsTotal,
      earnedBeansTotal,
      // 4
      whitelistedAssetTotals,
      // 5
      stemTips,
    ] = await Promise.all([
      // 0
      sdk.contracts.beanstalk.totalStalk().then(tokenResult(STALK)), // Does NOT include Grown Stalk
      new BigNumberJS(0), //
      sdk.contracts.beanstalk.totalRoots().then(bigNumberResult), //
      sdk.contracts.beanstalk.totalEarnedBeans().then(tokenResult(BEAN)),

      // 4
      // FIXME: Could save a lot of network requests by moving this to the Subgraph
      Promise.all(
        [...sdk.tokens.siloWhitelist].map((token) =>
          Promise.all([
            // FIXME: duplicate tokenResult optimization
            sdk.contracts.beanstalk
              .getTotalDeposited(token.address)
              .then((v) => transform(v, 'bnjs', token)),
            sdk.contracts.beanstalk
              .getTotalWithdrawn(token.address)
              .then((v) => transform(v, 'bnjs', token)),

            // BEAN will always have a fixed BDV of 1, skip to save a network request
            token === sdk.tokens.BEAN
              ? ONE_BN
              : sdk.contracts.beanstalk
                  .bdv(token.address, token.amount(1).toBlockchain())
                  .then(tokenResult(BEAN))
                  .catch((err) => {
                    console.error(`Failed to fetch BDV: ${token.address}`);
                    console.error(err);
                    throw err;
                  }),

            sdk.silo.getStemTip(token).then((v) => transform(v, 'ethers')),

            sdk.contracts.beanstalk
              .getTotalDepositedBdv(token.address)
              .then(tokenResult(BEAN)),
          ]).then((data) => ({
            address: token.address.toLowerCase(),
            deposited: data[0],
            withdrawn: data[1],
            bdvPerToken: data[2],
            stemTip: data[3],
            depositedBdv: data[4],
          }))
        )
      ),

      // 5
      sdk.silo.getStemTips([...sdk.tokens.siloWhitelist]),
    ] as const);

    console.debug('[beanstalk/silo/useBeanstalkSilo] RESULT', [
      stalkTotal,
      bdvTotal,
      whitelistedAssetTotals[0],
      whitelistedAssetTotals[0].deposited.toString(),
    ]);

    // farmableStalk and farmableSeed are derived from farmableBeans
    // because 1 bean = 1 stalk, 2 seeds
    const activeStalkTotal = stalkTotal;
    const earnedStalkTotal = earnedBeansTotal.times(BEAN_TO_STALK);
    const earnedSeedTotal = earnedBeansTotal.times(BEAN_TO_SEEDS);

    /// Aggregate balances
    const balances = whitelistedAssetTotals.reduce((agg, curr) => {
      const token = sdk.tokens.findByAddress(curr.address);
      if (!token) throw new Error(`Token not found in SDK: ${curr.address}`);

      const stemTip = stemTips.get(token);
      if (!stemTip)
        throw new Error(`Stem Tip not found in SDK: ${curr.address}`);

      agg[curr.address] = {
        stemTip,
        bdvPerToken: curr.bdvPerToken,
        deposited: {
          amount: curr.deposited,
        },
        withdrawn: {
          amount: curr.withdrawn,
        },
      };

      return agg;
    }, {} as TokenMap<BeanstalkSiloBalance>);

    // total:   active & inactive
    // active:  owned, actively earning other silo assets
    // earned:  active but not yet deposited into a Season
    // grown:   inactive
    dispatch(
      updateBeanstalkSilo({
        // Balances
        balances,
        // Rewards
        beans: {
          earned: earnedBeansTotal,
          total: balances[Bean.address].deposited.amount,
        },
        stalk: {
          active: activeStalkTotal,
          earned: earnedStalkTotal,
          grown: ZERO_BN,
          total: activeStalkTotal.plus(ZERO_BN),
        },
        seeds: {
          active: bdvTotal,
          earned: earnedSeedTotal,
          total: bdvTotal.plus(earnedSeedTotal),
        },
        roots: {
          total: rootsTotal,
        },
        // Metadata
        withdrawSeasons: ZERO_BN,
      })
    );
  }, [sdk, dispatch, Bean.address]);

  const clear = useCallback(() => {
    console.debug('[beanstalk/silo/useBeanstalkSilo] CLEAR');
    dispatch(resetBeanstalkSilo());
  }, [dispatch]);

  return [fetch, clear] as const;
};

// -- Updater

const BeanstalkSiloUpdater = () => {
  const [fetch, clear] = useFetchBeanstalkSilo();

  useEffect(() => {
    clear();
    fetch();
  }, [clear, fetch]);

  return null;
};

export default BeanstalkSiloUpdater;
