import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { tokenIshEqual, transform, getTokenIndex } from '~/util';
import useSdk from '~/hooks/sdk';
import {
  BeanstalkSDK,
  Token,
  Clipboard,
  AdvancedPipeStruct,
} from '@beanstalk/sdk';
import BNJS from 'bignumber.js';
import {
  BEAN_TO_SEEDS,
  BEAN_TO_STALK,
  ONE_BN,
  TokenMap,
  ZERO_BN,
} from '~/constants';
import { chunkArray } from '~/util/UI';
import { ethers } from 'ethers';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import { resetBeanstalkSilo, updateBeanstalkSilo } from './actions';
import { BeanstalkSiloBalance } from '.';

export const useFetchBeanstalkSilo = () => {
  const dispatch = useDispatch();
  const sdk = useSdk();

  /// Handlers
  const fetch = useCallback(async () => {
    const beanstalk = sdk.contracts.beanstalk;

    try {
      if (!beanstalk) return;

      const BEAN = sdk.tokens.BEAN;

      const wl = await sdk.contracts.beanstalk.getWhitelistedTokens();
      const whitelist = wl
        .map((t) => sdk.tokens.findByAddress(t))
        .filter(Boolean) as Token[];

      const [stemTips, siloResults, wlResults, bdvs] = await Promise.all([
        sdk.silo.getStemTips(),
        getSiloResults(sdk),
        getWhitelistResults(sdk, whitelist),
        getBDVs(sdk, whitelist),
      ]);

      const stalkTotal = siloResults.totalStalk;
      const rootsTotal = siloResults.totalRoots;
      const earnedBeansTotal = siloResults.totalEarnedBeans;
      const bdvTotal = ZERO_BN;

      const whitelistedAssetTotals: ({
        address: string;
        deposited: BNJS;
        depositedBdv: BNJS;
        totalGerminating: BNJS;
        bdvPerToken: BNJS;
        stemTip: ethers.BigNumber;
      } | null)[] = [];

      Object.values(wlResults).forEach((datas, i) => {
        const token = whitelist[i];

        const stemTip = stemTips.get(token.address);
        if (!stemTip) {
          whitelistedAssetTotals.push(null);
        }

        whitelistedAssetTotals.push({
          address: token.address,
          deposited: datas.deposited,
          depositedBdv: datas.depositedBdv,
          totalGerminating: datas.germinating,
          bdvPerToken: bdvs[i],
          stemTip: stemTips.get(token.address) || ethers.BigNumber.from(0),
        });
      });

      console.debug('[beanstalk/silo/useBeanstalkSilo] RESULT', [
        stalkTotal,
        bdvTotal,
        whitelistedAssetTotals[0],
        whitelistedAssetTotals[0]?.deposited.toString(),
      ]);

      // farmableStalk and farmableSeed are derived from farmableBeans
      // because 1 bean = 1 stalk, 2 seeds
      const activeStalkTotal = stalkTotal;
      const earnedStalkTotal = earnedBeansTotal.times(BEAN_TO_STALK);
      const earnedSeedTotal = earnedBeansTotal.times(BEAN_TO_SEEDS); // FIX ME

      /// Aggregate balances
      const balances = whitelistedAssetTotals.reduce((agg, curr) => {
        if (!curr) return agg;
        const token = sdk.tokens.findByAddress(curr.address);
        if (!token) throw new Error(`Token not found in SDK: ${curr.address}`);

        const stemTip = stemTips.get(token.address);
        if (!stemTip) {
          return agg;
        }

        agg[curr.address] = {
          stemTip,
          bdvPerToken: curr.bdvPerToken,
          deposited: {
            amount: curr.deposited,
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
    } catch (e) {
      console.log('[farmer/useFetchBeanstalkSilo] FAILED', e);
      console.error(e);
    }
  }, [sdk, dispatch]);

  const clear = useCallback(() => {
    console.debug('[beanstalk/silo/useBeanstalkSilo] CLEAR');
    dispatch(resetBeanstalkSilo());
  }, [dispatch]);

  return [fetch, clear] as const;
};

// -- Updater

const BeanstalkSiloUpdater = () => {
  const [fetch, clear] = useFetchBeanstalkSilo();

  useL2OnlyEffect(() => {
    clear();
    fetch();
  }, [clear, fetch]);

  return null;
};

export default BeanstalkSiloUpdater;

async function getSiloResults(sdk: BeanstalkSDK) {
  const beanstalk = sdk.contracts.beanstalk;
  const iBeanstalk = beanstalk.interface;

  const common = {
    target: beanstalk.address,
    clipboard: Clipboard.encode([]),
  };

  const fnNames = ['totalStalk', 'totalRoots', 'totalEarnedBeans'] as const;

  const calls: AdvancedPipeStruct[] = fnNames.map((fnName) => ({
    ...common,
    callData: iBeanstalk.encodeFunctionData(fnName as any),
  }));

  const result = await beanstalk.callStatic.advancedPipe(calls, '0');

  const _totalStalk = iBeanstalk.decodeFunctionResult(
    'totalStalk',
    result[0]
  )[0];
  const _totalRoots = iBeanstalk.decodeFunctionResult(
    'totalRoots',
    result[1]
  )[0];
  const _totalEarnedBeans = iBeanstalk.decodeFunctionResult(
    'totalEarnedBeans',
    result[2]
  )[0];

  return {
    calls,
    totalStalk: transform(_totalStalk, 'bnjs', sdk.tokens.STALK),
    totalRoots: transform(_totalRoots, 'bnjs'),
    totalEarnedBeans: transform(_totalEarnedBeans, 'bnjs', sdk.tokens.BEAN),
  };
}

interface WhitelistPipeResult {
  deposited: BNJS;
  depositedBdv: BNJS;
  germinating: BNJS;
}

async function getWhitelistResults(sdk: BeanstalkSDK, whitelist: Token[]) {
  const beanstalk = sdk.contracts.beanstalk;
  const iBeanstalk = beanstalk.interface;

  const common = {
    target: beanstalk.address,
    clipboard: Clipboard.encode([]),
  };

  const allCalls: AdvancedPipeStruct[] = whitelist
    .map((token) => {
      const tokenAddress = token.address;
      const calls = [
        iBeanstalk.encodeFunctionData('getTotalDeposited', [tokenAddress]),
        iBeanstalk.encodeFunctionData('getTotalDepositedBdv', [tokenAddress]),
        iBeanstalk.encodeFunctionData('getGerminatingTotalDeposited', [
          tokenAddress,
        ]),
      ];

      return calls.map((c) => ({
        ...common,
        callData: c,
      }));
    })
    .flat();

  const results = await beanstalk.callStatic.advancedPipe(allCalls, '0');

  const chunkedByToken = chunkArray(results, 3);

  return whitelist.reduce<TokenMap<WhitelistPipeResult>>((prev, token, i) => {
    const tokenChunk = chunkedByToken[i];

    const deposited = iBeanstalk.decodeFunctionResult(
      'getTotalDeposited',
      tokenChunk[0]
    )[0];
    const depositedBdv = iBeanstalk.decodeFunctionResult(
      'getTotalDepositedBdv',
      tokenChunk[1]
    )[0];
    const germinating = iBeanstalk.decodeFunctionResult(
      'getGerminatingTotalDeposited',
      tokenChunk[2]
    )[0];

    prev[getTokenIndex(token)] = {
      deposited: transform(deposited, 'bnjs', token),
      depositedBdv: transform(depositedBdv, 'bnjs', sdk.tokens.BEAN),
      germinating: transform(germinating, 'bnjs', token),
    };

    return prev;
  }, {});
}

async function getBDVs(sdk: BeanstalkSDK, whitelist: Token[]) {
  const beanstalk = sdk.contracts.beanstalk;

  return Promise.all(
    whitelist.map((token) =>
      beanstalk
        .bdv(token.address, token.fromHuman(1).blockchainString)
        .then((r) => {
          if (tokenIshEqual(token, sdk.tokens.BEAN)) {
            return ONE_BN;
          }
          return transform(r, 'bnjs', sdk.tokens.BEAN) as BNJS;
        })
        .catch((e) => {
          console.debug(
            '[beanstalk/silo/updater] bdv failed for token',
            token.address,
            e
          );
          return ZERO_BN;
        })
    )
  );
}
