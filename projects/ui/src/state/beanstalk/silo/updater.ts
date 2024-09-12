import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { tokenIshEqual, transform } from '~/util';
import useSdk from '~/hooks/sdk';
import { Token } from '@beanstalk/sdk';
import { ContractFunctionParameters } from 'viem';
import { multicall } from '@wagmi/core';
import { config } from '~/util/wagmi/config';
import BNJS from 'bignumber.js';
import {
  ABISnippets,
  BEAN_TO_SEEDS,
  BEAN_TO_STALK,
  ONE_BN,
  TokenMap,
  ZERO_BN,
} from '~/constants';
import { chunkArray } from '~/util/UI';
import { ethers } from 'ethers';
import { resetBeanstalkSilo, updateBeanstalkSilo } from './actions';
import { BeanstalkSiloBalance } from '.';

// limit to maximum of 20 calls per multicall. (5 * 4 = 20)
const MAX_BUCKETS = 5;

// 4 queries per token
const QUERIES_PER_TK = 4;

export const useFetchBeanstalkSilo = () => {
  const dispatch = useDispatch();
  const sdk = useSdk();

  /// Handlers
  const fetch = useCallback(async () => {
    const beanstalk = sdk.contracts.beanstalk;

    try {
      if (!beanstalk) return;

      const BEAN = sdk.tokens.BEAN;
      const STALK = sdk.tokens.STALK;

      const wl = await sdk.contracts.beanstalk.getWhitelistedTokens();
      const whitelist = wl
        .map((t) => sdk.tokens.findByAddress(t))
        .filter(Boolean) as Token[];

      const wlContractCalls = buildWhitelistMultiCall(beanstalk, whitelist);
      const siloCalls = buildBeanstalkSiloMultiCall(beanstalk.address);

      const [stemTips, siloResults, wlResults] = await Promise.all([
        sdk.silo.getStemTips(),
        multicall(config, { contracts: siloCalls }),
        Promise.all(
          wlContractCalls.map((calls) =>
            multicall(config, { contracts: calls })
          )
        ),
      ]);

      const parsedSiloData = siloResults.map((r) => parseCallResult(r));
      const stalkTotal = transform(parsedSiloData[0], 'bnjs', STALK);
      const rootsTotal = transform(parsedSiloData[1], 'bnjs');
      const earnedBeansTotal = transform(parsedSiloData[2], 'bnjs', BEAN);
      const bdvTotal = ZERO_BN;

      const chunked = chunkArray(wlResults.flat(), QUERIES_PER_TK);
      const whitelistedAssetTotals: ({
        address: string;
        deposited: BNJS;
        depositedBdv: BNJS;
        totalGerminating: BNJS;
        bdvPerToken: BNJS;
        stemTip: ethers.BigNumber;
      } | null)[] = [];

      chunked.forEach((chunk, i) => {
        const token = whitelist[i];
        const data = chunk.map((d) => parseCallResult(d));

        const stemTip = stemTips.get(token.address);
        if (!stemTip) {
          whitelistedAssetTotals.push(null);
        }

        whitelistedAssetTotals.push({
          address: token.address,
          deposited: transform(data[0], 'bnjs', token),
          depositedBdv: tokenIshEqual(token, sdk.tokens.BEAN)
            ? ONE_BN
            : transform(data[1], 'bnjs', token),
          totalGerminating: transform(data[2], 'bnjs', token),
          bdvPerToken: transform(data[3], 'bnjs', token),
          stemTip: stemTips.get(token.address) || ethers.BigNumber.from(0),
        });
      });

      // const whitelistedAssetTotals = chunked.map((chunk, i) => {
      //   const token = whitelist[i];
      //   const data = chunk.map((d) => parseCallResult(d));

      //   const stemTip = stemTips.get(token.address);

      //   if (!stemTip) {
      //     throw new Error(
      //       `[beanstalk/silo/useFetchBeanstalkSilo]: Stem Tip not found for: ${token.symbol}`
      //     );
      //   }

      //   return {
      //     address: token.address,
      //     deposited: transform(data[0], 'bnjs', token),
      //     depositedBdv: tokenIshEqual(token, sdk.tokens.BEAN)
      //       ? ONE_BN
      //       : transform(data[1], 'bnjs', token),
      //     totalGerminating: transform(data[2], 'bnjs', token),
      //     bdvPerToken: transform(data[3], 'bnjs', token),
      //     stemTip: stemTips.get(token.address) || ethers.BigNumber.from(0),
      //   };
      // });

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
      const earnedSeedTotal = earnedBeansTotal.times(BEAN_TO_SEEDS);

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

  useEffect(() => {
    clear();
    fetch();
  }, [clear, fetch]);

  return null;
};

export default BeanstalkSiloUpdater;

// -- Helper Types

type CallParams = ContractFunctionParameters<typeof ABISnippets.siloGetters>;

type CallResult = Awaited<
  ReturnType<typeof multicall<typeof config, CallParams[]>>
>[number];

// -- Helpers

function parseCallResult(
  result: CallResult,
  defaultValue: bigint = -1n
): bigint {
  if (result.error) return defaultValue;
  return result.result;
}

function buildWhitelistMultiCall(
  beanstalk: ReturnType<typeof useSdk>['contracts']['beanstalk'],
  // ensure silo whitelist is order is consistent w/ the multiCall results
  whitelist: Token[]
): CallParams[][] {
  const beanstalkAddress = beanstalk.address as `0x{string}`;
  const contractCalls: CallParams[][] = [];

  const shared = {
    address: beanstalkAddress,
    abi: ABISnippets.siloGetters,
  };

  let callBucket: CallParams[] = [];
  whitelist.forEach((token, i) => {
    const tokenAddress = token.address as `0x{string}`;
    const calls: CallParams[] = [
      {
        ...shared,
        functionName: 'getTotalDeposited',
        args: [tokenAddress],
      },
      {
        ...shared,
        functionName: 'getTotalDepositedBdv',
        args: [tokenAddress],
      },
      {
        ...shared,
        functionName: 'getGerminatingTotalDeposited',
        args: [tokenAddress],
      },
      {
        ...shared,
        functionName: 'bdv',
        args: [tokenAddress, BigInt(token.fromHuman(1).blockchainString)],
      },
    ];
    callBucket.push(...calls);

    if (i % MAX_BUCKETS === MAX_BUCKETS - 1) {
      contractCalls.push(callBucket);
      callBucket = [];
    }
  });

  if (callBucket.length) contractCalls.push(callBucket);

  return contractCalls;
}

function buildBeanstalkSiloMultiCall(beanstalkAddress: string): CallParams[] {
  const shared = {
    address: beanstalkAddress as `0x{string}`,
    abi: ABISnippets.siloGetters,
  };

  return [
    {
      ...shared,
      functionName: 'totalStalk',
      args: [],
    },
    {
      ...shared,
      functionName: 'totalRoots',
      args: [],
    },
    {
      ...shared,
      functionName: 'totalEarnedBeans',
      args: [],
    },
  ];
}

// const [
//   // 0
//   _stalkTotal,
//   _bdvTotal,
//   _rootsTotal,
//   _earnedBeansTotal,
//   // 4
//   _whitelistedAssetTotals,
//   // 5
//   _stemTips,
// ] = await Promise.all([
//   // 0
//   beanstalk.totalStalk().then(tokenResult(STALK)), // Does NOT include Grown Stalk
//   new BigNumberJS(0), //
//   beanstalk.totalRoots().then(bigNumberResult), //
//   beanstalk.totalEarnedBeans().then(tokenResult(BEAN)),

//   // 4
//   // FIXME: Could save a lot of network requests by moving this to the Subgraph
//   Promise.all(
//     [...sdk.tokens.siloWhitelist].map((token) =>
//       Promise.all([
//         // FIXME: duplicate tokenResult optimization
//         beanstalk
//           .getTotalDeposited(token.address)
//           .then((v) => transform(v, 'bnjs', token)),
//         // BEAN will always have a fixed BDV of 1, skip to save a network request
//         tokenIshEqual(token, BEAN)
//           ? ONE_BN
//           : beanstalk
//               .bdv(token.address, token.amount(1).toBlockchain())
//               .then(tokenResult(BEAN))
//               .catch((err) => {
//                 console.error(`Failed to fetch BDV: ${token.address}`);
//                 console.error(err);
//                 throw err;
//               }),
//         sdk.silo.getStemTip(token),
//         beanstalk
//           .getTotalDepositedBdv(token.address)
//           .then(tokenResult(BEAN)),
//         beanstalk
//           .getGerminatingTotalDeposited(token.address)
//           .then((v) => transform(v, 'bnjs', token)),
//       ]).then((data) => ({
//         address: token.address.toLowerCase(),
//         deposited: data[0],
//         bdvPerToken: data[1],
//         stemTip: data[2],
//         depositedBdv: data[3],
//         totalGerminating: data[4],
//       }))
//     )
//   ),

//   //   // 5
//   sdk.silo.getStemTips(),
// ] as const);
