import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useDispatch } from 'react-redux';
import throttle from 'lodash/throttle';
import { multicall } from '@wagmi/core';

import { displayBeanPrice, tokenResult, exists } from '~/util';
import useSdk from '~/hooks/sdk';
import { ContractFunctionParameters, erc20Abi } from 'viem';
import BEANSTALK_ABI_SNIPPETS from '~/constants/abi/Beanstalk/abiSnippets';
import { config } from '~/util/wagmi/config';
import { ERC20Token, Pool } from '@beanstalk/sdk';
import { chunkArray } from '~/util/UI';
import { getExtractMulticallResult } from '~/util/Multicall';
import { transform } from '~/util/BigNumber';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import { resetPools, updateBeanPools, UpdatePoolPayload } from './actions';
import { updateDeltaB, updatePrice, updateSupply } from '../token/actions';

const pageContext = '[bean/pools/useGetPools]';

const extract = getExtractMulticallResult(pageContext);

export const useFetchPools = () => {
  const dispatch = useDispatch();
  const sdk = useSdk();

  // Handlers
  const _fetch = useCallback(async () => {
    const { beanstalk, beanstalkPrice } = sdk.contracts;
    try {
      if (beanstalk && beanstalkPrice) {
        console.debug(`${pageContext} FETCH`, beanstalkPrice.address);

        const whitelistedPools = sdk.pools.whitelistedPools;
        const poolsArr = [...whitelistedPools.values()];
        const BEAN = sdk.tokens.BEAN;

        const priceAndBeanCalls = [
          makePriceMulticall(beanstalkPrice.address),
          makeTokenTotalSupplyMulticall(BEAN),
          makeTotalDeltaBMulticall(beanstalk.address),
        ];
        const lpMulticall = makeLPMulticall(beanstalk.address, poolsArr);

        const [priceAndBean, _lpResults] = await Promise.all([
          // fetch [price, bean.totalSupply, totalDeltaB]
          multicall(config, {
            contracts: priceAndBeanCalls,
            allowFailure: true,
          }),
          // fetch [poolDeltaB, totalSupply] for each pool, in chunks of 20
          Promise.all(
            lpMulticall.calls.map((lpCall) =>
              multicall(config, {
                contracts: lpCall,
                allowFailure: true,
              })
            )
          ).then((result) => chunkArray(result.flat(), lpMulticall.chunkSize)),
        ]);

        console.debug(`${pageContext} MULTICALL RESULTS: `, {
          lpMulticall,
          priceAndBeanCalls,
          _lpResults,
          priceAndBean,
        });

        const [priceResult, beanTotalSupply, totalDeltaB] = [
          extract<PriceResultStruct>(priceAndBean[0], 'price'),
          extract(priceAndBean[1], 'bean.totalSupply'),
          extract(priceAndBean[2], 'totalDeltaB'),
        ];

        const lpResults = _lpResults.reduce<Record<string, LPResultType>>(
          (prev, [_deltaB, _supply], i) => {
            const lp = poolsArr[i].lpToken;

            prev[lp.address.toLowerCase()] = {
              deltaB: extract(_deltaB, `${lp.symbol} poolDeltaB`),
              supply: extract(_supply, `${lp.symbol} totalSupply`),
            };
            return prev;
          },
          {}
        );
        if (priceResult) {
          const price = tokenResult(BEAN)(priceResult.price.toString());

          const poolsPayload = priceResult.ps.reduce<UpdatePoolPayload[]>(
            (acc, poolData) => {
              const address = poolData.pool.toLowerCase();
              const pool = sdk.pools.getPoolByLPToken(address);
              const lpResult = lpResults[address];

              if (pool && exists(lpResult.deltaB) && exists(lpResult.supply)) {
                const payload: UpdatePoolPayload = {
                  address: address,
                  pool: {
                    price: transform(poolData.price, 'bnjs', BEAN),
                    reserves: [
                      transform(poolData.balances[0], 'bnjs', pool.tokens[0]),
                      transform(poolData.balances[1], 'bnjs', pool.tokens[1]),
                    ],
                    deltaB: transform(poolData.deltaB, 'bnjs', BEAN),
                    supply: transform(lpResult.supply, 'bnjs', pool.lpToken),
                    // Liquidity: always denominated in USD for the price contract
                    liquidity: transform(poolData.liquidity, 'bnjs', BEAN),
                    // USD value of 1 LP token == liquidity / supply
                    totalCrosses: new BigNumber(0),
                    lpUsd: transform(poolData.lpUsd, 'bnjs', BEAN),
                    lpBdv: transform(poolData.lpBdv, 'bnjs', BEAN),
                    twaDeltaB: transform(lpResult.deltaB, 'bnjs', BEAN),
                  },
                } as UpdatePoolPayload;
                acc.push(payload);
              } else {
                console.debug(
                  `${pageContext} price contract returned data for pool ${address} but it isn't configured, skipping. available pools:`,
                  sdk.pools.pools
                );
              }
              return acc;
            },
            []
          );
          dispatch(updatePrice(price));
          dispatch(updateBeanPools(poolsPayload));

          if (price) {
            document.title = `$${displayBeanPrice(price, 4)} · Beanstalk App`;
          }
        }

        if (beanTotalSupply) {
          dispatch(updateSupply(transform(beanTotalSupply, 'bnjs', BEAN)));
        }

        if (totalDeltaB) {
          dispatch(updateDeltaB(transform(totalDeltaB, 'bnjs', BEAN)));
        }
      }
    } catch (e) {
      console.debug(`${pageContext} FAILED`, e);
      console.error(e);
    }
  }, [sdk.contracts, sdk.pools, sdk.tokens.BEAN, dispatch]);

  const clear = useCallback(() => {
    dispatch(resetPools());
  }, [dispatch]);

  const fetch = useMemo(() => throttle(_fetch, 1000), [_fetch]);

  return [fetch, clear];
};

export const useThrottledFetchPools = () => {
  const [fetch] = useFetchPools();

  return useMemo(() => throttle(fetch, 10_000), [fetch]);
};

// ------------------------------------------

const PoolsUpdater = () => {
  const [fetch, clear] = useFetchPools();

  useL2OnlyEffect(() => {
    clear();
    fetch();
  }, [fetch, clear]);

  // useTimedRefresh(fetch, 15_000, true, true);

  return null;
};

export default PoolsUpdater;

// ------------------------------------------
// Types

type PriceResultStruct = {
  price: bigint;
  liquidity: bigint;
  deltaB: bigint;
  ps: {
    pool: string;
    tokens: [string, string];
    balances: [bigint, bigint];
    price: bigint;
    liquidity: bigint;
    deltaB: bigint;
    lpUsd: bigint;
    lpBdv: bigint;
  }[];
};

type LPResultType = {
  deltaB: bigint | null;
  supply: bigint | null;
};

// ------------------------------------------
// Helpers

function makeTokenTotalSupplyMulticall(
  token: ERC20Token
): ContractFunctionParameters<typeof erc20Abi> {
  return {
    address: token.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'totalSupply',
    args: [],
  };
}

function makeTotalDeltaBMulticall(
  beanstalkAddress: string
): ContractFunctionParameters<typeof BEANSTALK_ABI_SNIPPETS.totalDeltaB> {
  return {
    address: beanstalkAddress as `0x${string}`,
    abi: BEANSTALK_ABI_SNIPPETS.totalDeltaB,
    functionName: 'totalDeltaB',
    args: [],
  };
}

function makePriceMulticall(
  address: string
): ContractFunctionParameters<typeof BEANSTALK_ABI_SNIPPETS.price> {
  return {
    address: address as `0x${string}`,
    abi: BEANSTALK_ABI_SNIPPETS.price,
    functionName: 'price',
    args: [],
  };
}

function makeLPMulticall(
  beanstalkAddress: string,
  pools: Pool[]
): {
  calls: ContractFunctionParameters[][];
  chunkSize: number;
} {
  const calls: ContractFunctionParameters[] = [];

  pools.forEach((pool) => {
    const address = pool.address as `0x${string}`;
    const deltaBCall: ContractFunctionParameters<
      typeof BEANSTALK_ABI_SNIPPETS.poolDeltaB
    > = {
      address: beanstalkAddress as `0x${string}`,
      abi: BEANSTALK_ABI_SNIPPETS.poolDeltaB,
      functionName: 'poolDeltaB',
      args: [address],
    };
    const totalSupplyCall = makeTokenTotalSupplyMulticall(pool.lpToken);

    calls.push(deltaBCall, totalSupplyCall);
  });

  return {
    calls: chunkArray(calls, 20),
    chunkSize: 2,
  };
}
