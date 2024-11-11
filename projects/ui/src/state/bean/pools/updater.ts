import { useCallback, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useDispatch } from 'react-redux';
import throttle from 'lodash/throttle';

import { displayBeanPrice, getTokenIndex, tokenResult } from '~/util';
import useSdk from '~/hooks/sdk';
import {
  AdvancedPipeStruct,
  BeanstalkSDK,
  Clipboard,
  Pool,
} from '@beanstalk/sdk';
import { chunkArray } from '~/util/UI';
import { transform } from '~/util/BigNumber';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import { TokenMap } from '~/constants';
import { resetPools, updateBeanPools, UpdatePoolPayload } from './actions';
import { updateDeltaB, updatePrice, updateSupply } from '../token/actions';

const pageContext = '[bean/pools/useGetPools]';

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

        const [priceResult, beanTotalSupply, totalDeltaB, lpResults] =
          await Promise.all([
            beanstalkPrice.price(),
            BEAN.getContract().totalSupply().then(tokenResult(BEAN)),
            beanstalk.totalDeltaB().then(tokenResult(BEAN)),
            fetchPoolsData(sdk, poolsArr),
          ]);

        console.debug(`${pageContext} FETCH: `, {
          priceResult,
          lpResults,
          beanTotalSupply,
          totalDeltaB,
        });

        if (priceResult) {
          const price = tokenResult(BEAN)(priceResult.price.toString());

          const poolsPayload = priceResult.ps.reduce<UpdatePoolPayload[]>(
            (acc, poolData) => {
              const address = poolData.pool.toLowerCase();
              const pool = sdk.pools.getPoolByLPToken(address);

              if (pool) {
                const lpResult = lpResults[getTokenIndex(pool.lpToken)];
                const payload: UpdatePoolPayload = {
                  address: address,
                  pool: {
                    price: transform(poolData.price, 'bnjs', BEAN),
                    reserves: [
                      transform(poolData.balances[0], 'bnjs', pool.tokens[0]),
                      transform(poolData.balances[1], 'bnjs', pool.tokens[1]),
                    ],
                    deltaB: transform(poolData.deltaB, 'bnjs', BEAN),
                    supply: lpResult.totalSupply,
                    // Liquidity: always denominated in USD for the price contract
                    liquidity: transform(poolData.liquidity, 'bnjs', BEAN),
                    // USD value of 1 LP token == liquidity / supply
                    totalCrosses: new BigNumber(0),
                    lpUsd: transform(poolData.lpUsd, 'bnjs', BEAN),
                    lpBdv: transform(poolData.lpBdv, 'bnjs', BEAN),
                    twaDeltaB: lpResult.twaDeltaB
                      ? transform(lpResult.twaDeltaB, 'bnjs', BEAN)
                      : null,
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
          dispatch(updateSupply(beanTotalSupply));
        }

        if (totalDeltaB) {
          dispatch(updateDeltaB(transform(totalDeltaB, 'bnjs', BEAN)));
        }
      }
    } catch (e) {
      console.debug(`${pageContext} FAILED`, e);
      console.error(e);
    }
  }, [sdk, dispatch]);

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

async function fetchPoolsData(sdk: BeanstalkSDK, pools: Pool[]) {
  const { beanstalk } = sdk.contracts;

  const calls: AdvancedPipeStruct[] = pools
    .map((pool) => {
      const deltaBCall = {
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('poolCurrentDeltaB', [
          pool.address,
        ]),
        clipboard: Clipboard.encode([]),
      };
      const supplyCall = {
        target: pool.lpToken.address,
        callData: pool.lpToken
          .getContract()
          .interface.encodeFunctionData('totalSupply'),
        clipboard: Clipboard.encode([]),
      };

      return [deltaBCall, supplyCall];
    })
    .flat();

  const result = await sdk.contracts.beanstalk.callStatic.advancedPipe(
    calls,
    '0'
  );
  const chunkedByPool = chunkArray(result, 2);

  const datas = pools.reduce<
    TokenMap<{
      totalSupply: BigNumber;
      twaDeltaB: BigNumber;
    }>
  >((prev, curr, i) => {
    const [deltaBResult, totalSupplyResult] = chunkedByPool[i];

    const deltaB = beanstalk.interface.decodeFunctionResult(
      'poolCurrentDeltaB',
      deltaBResult
    )[0];
    const totalSupply = curr.lpToken
      .getContract()
      .interface.decodeFunctionResult('totalSupply', totalSupplyResult)[0];

    prev[getTokenIndex(curr)] = {
      totalSupply: transform(totalSupply, 'bnjs', curr.lpToken),
      twaDeltaB: transform(deltaB, 'bnjs', sdk.tokens.BEAN),
    };
    return prev;
  }, {});

  return datas;
}
