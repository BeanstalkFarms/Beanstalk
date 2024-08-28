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
import useSdk from '~/hooks/sdk';
import { resetBeanstalkSilo, updateBeanstalkSilo } from './actions';
import { BeanstalkSiloBalance } from './index';

export const useFetchBeanstalkSilo = () => {
  const dispatch = useDispatch();
  const sdk = useSdk();

  /// Handlers
  const fetch = useCallback(async () => {
    const beanstalk = sdk.contracts.beanstalk;
    const BEAN = sdk.tokens.BEAN;
    const STALK = sdk.tokens.STALK;

    const whitelist = [...sdk.tokens.siloWhitelist];

    const [
      _stalkTotal,
      _rootsTotal,
      _bdvsTotal,
      _bdvs,
      _stemTips,
      _earnedBeansTotal,
      _whitelistedAssetTotals,
    ] = await Promise.all([
      beanstalk.totalStalk().then(tokenResult(STALK)), // Does NOT include Grown Stalk
      beanstalk.totalRoots().then(bigNumberResult),
      Promise.resolve(BigNumberJS(0)),
      beanstalk.bdvs(
        whitelist.map((t) => t.address),
        whitelist.map((t) => t.amount(1).toBlockchain())
      ),
      sdk.silo.getStemTips(),
      beanstalk.totalEarnedBeans().then(tokenResult(BEAN)),
      Promise.all(
        whitelist.map((token) =>
          Promise.all([
            beanstalk.getTotalDeposited(token.address).then(tokenResult(token)),
            beanstalk
              .getTotalDepositedBdv(token.address)
              .then(tokenResult(BEAN)),
            beanstalk
              .getGerminatingTotalDeposited(token.address)
              .then(tokenResult(token)),
            beanstalk
              .bdv(token.address, token.amount(1).toBlockchain())
              .then(tokenResult(BEAN)),
          ]).then((data) => ({
            address: token.address,
            deposited: data[0],
            depositedBdv: data[1],
            totalGerminating: data[2],
            bdvPerToken: data[3],
          }))
        )
      ),
    ]);

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
      beanstalk.totalStalk().then(tokenResult(STALK)), // Does NOT include Grown Stalk
      new BigNumberJS(0), //
      beanstalk.totalRoots().then(bigNumberResult), //
      beanstalk.totalEarnedBeans().then(tokenResult(BEAN)),

      // 4
      // FIXME: Could save a lot of network requests by moving this to the Subgraph
      Promise.all(
        [...sdk.tokens.siloWhitelist].map((token) =>
          Promise.all([
            // FIXME: duplicate tokenResult optimization
            beanstalk
              .getTotalDeposited(token.address)
              .then((v) => transform(v, 'bnjs', token)),
            // BEAN will always have a fixed BDV of 1, skip to save a network request
            token === BEAN
              ? ONE_BN
              : beanstalk
                  .bdv(token.address, token.amount(1).toBlockchain())
                  .then(tokenResult(BEAN))
                  .catch((err) => {
                    console.error(`Failed to fetch BDV: ${token.address}`);
                    console.error(err);
                    throw err;
                  }),
            sdk.silo.getStemTip(token),
            beanstalk
              .getTotalDepositedBdv(token.address)
              .then(tokenResult(BEAN)),
            beanstalk
              .getGerminatingTotalDeposited(token.address)
              .then((v) => transform(v, 'bnjs', token)),
          ]).then((data) => ({
            address: token.address.toLowerCase(),
            deposited: data[0],
            bdvPerToken: data[1],
            stemTip: data[2],
            depositedBdv: data[3],
            totalGerminating: data[4],
          }))
        )
      ),

      // 5
      sdk.silo.getStemTips(),
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

      const stemTip = stemTips.get(token.address);
      if (!stemTip)
        throw new Error(`Stem Tip not found in SDK: ${curr.address}`);

      agg[curr.address] = {
        stemTip,
        bdvPerToken: curr.bdvPerToken,
        deposited: {
          amount: curr.deposited,
        },
        withdrawn: {
          amount: ZERO_BN,
        },
        germinating: {
          amount: curr.totalGerminating,
        },
        TVD: curr.deposited.plus(curr.totalGerminating),
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
          total: balances[BEAN.address].deposited.amount,
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
  }, [sdk.contracts.beanstalk, sdk.tokens, sdk.silo, dispatch]);

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
