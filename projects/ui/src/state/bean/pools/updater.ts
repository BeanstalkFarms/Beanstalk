import { useCallback, useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';
import { useDispatch } from 'react-redux';
import throttle from 'lodash/throttle';

import { tokenResult, displayBeanPrice } from '~/util';
import { ERC20__factory } from '~/generated';
import { useEthersProvider } from '~/util/wagmi/ethersAdapter';
import useSdk from '~/hooks/sdk';
import { updatePrice, updateDeltaB, updateSupply } from '../token/actions';
import { resetPools, updateBeanPools, UpdatePoolPayload } from './actions';

export const useFetchPools = () => {
  const dispatch = useDispatch();
  const provider = useEthersProvider();
  const sdk = useSdk();
  const { beanstalk, beanstalkPrice } = sdk.contracts;

  // Handlers
  const _fetch = useCallback(async () => {
    try {
      if (beanstalk && beanstalkPrice) {
        console.debug('[bean/pools/useGetPools] FETCH', beanstalkPrice.address);

        const whitelistedPools = sdk.pools.whitelistedPools;
        const BEAN = sdk.tokens.BEAN;

        // FIXME: find regression with Bean.totalSupply()
        const [priceResult, totalSupply, totalDeltaB] = await Promise.all([
          beanstalkPrice.price(),
          // FIXME: these should probably reside in bean/token/updater,
          // but the above beanstalkPriceContract call also grabs the
          // aggregate price, so for now we bundle them here.
          sdk.tokens.BEAN.getTotalSupply().then(
            (r) => new BigNumber(r.toHuman())
          ),
          beanstalk.totalDeltaB().then(tokenResult(BEAN)), // TWAdeltaB
        ]);

        if (!priceResult) return;

        console.debug(
          '[bean/pools/useGetPools] RESULT: price contract result =',
          priceResult,
          totalSupply.toString()
        );

        // Step 2: Get LP token supply data and format as UpdatePoolPayload
        const dataWithSupplyResult: Promise<UpdatePoolPayload>[] = [
          ...priceResult.ps.reduce<Promise<UpdatePoolPayload>[]>(
            (acc, poolData) => {
              // NOTE:
              // The below address must be lower-cased. All internal Pool/Token
              // addresses are case-insensitive and stored as lowercase strings.
              const address = poolData.pool.toLowerCase();

              // If a new pool is added to the Pools contract before it's
              // configured in the frontend, this function would throw an error.
              // Thus, we only process the pool's data if we have it configured.

              const pool = sdk.pools.getPoolByLPToken(address);
              if (pool) {
                acc.push(
                  ERC20__factory.connect(pool.lpToken.address, provider)
                    .totalSupply()
                    .then(
                      (supply) =>
                        ({
                          address: poolData.pool,
                          pool: {
                            price: tokenResult(BEAN)(poolData.price.toString()),
                            reserves: [
                              // NOTE:
                              // Assumes that the ordering of tokens in the Pool instance
                              // matches the order returned by the price contract.
                              tokenResult(pool.tokens[0])(poolData.balances[0]),
                              tokenResult(pool.tokens[1])(poolData.balances[1]),
                            ],
                            deltaB: tokenResult(BEAN)(
                              poolData.deltaB.toString()
                            ),
                            supply: tokenResult(pool.lpToken)(
                              supply.toString()
                            ),
                            // Liquidity: always denominated in USD for the price contract
                            liquidity: tokenResult(BEAN)(
                              poolData.liquidity.toString()
                            ),
                            // USD value of 1 LP token == liquidity / supply
                            totalCrosses: new BigNumber(0),
                            lpUsd: tokenResult(BEAN)(poolData.lpUsd),
                            lpBdv: tokenResult(BEAN)(poolData.lpBdv),
                            twaDeltaB: null,
                          },
                        }) as UpdatePoolPayload
                    )
                    .then((data) => {
                      if (whitelistedPools.has(data.address.toLowerCase())) {
                        return beanstalk
                          .poolDeltaB(data.address)
                          .then((twaDeltaB) => {
                            data.pool.twaDeltaB = tokenResult(BEAN)(
                              twaDeltaB.toString()
                            );
                            return data;
                          });
                      }

                      return data;
                    })
                    .catch((err) => {
                      console.debug(
                        '[beanstalk/pools/updater] Failed to get LP token supply',
                        pool.lpToken
                      );
                      console.error(err);
                      throw err;
                    })
                );
              } else {
                console.debug(
                  `[bean/pools/useGetPools] price contract returned data for pool ${address} but it isn't configured, skipping. available pools:`,
                  sdk.pools.pools
                );
              }
              return acc;
            },
            []
          ),
        ];

        console.debug(
          '[bean/pools/useGetPools] RESULT: dataWithSupply =',
          dataWithSupplyResult
        );

        const price = tokenResult(BEAN)(priceResult.price.toString());
        dispatch(updateBeanPools(await Promise.all(dataWithSupplyResult)));
        dispatch(updatePrice(price));
        dispatch(updateSupply(totalSupply));
        dispatch(updateDeltaB(totalDeltaB));

        if (price) {
          document.title = `$${displayBeanPrice(price, 4)} · Beanstalk App`;
        }
      }
    } catch (e) {
      console.debug('[bean/pools/useGetPools] FAILED', e);
      console.error(e);
    }
  }, [
    beanstalk,
    beanstalkPrice,
    sdk.pools,
    sdk.tokens.BEAN,
    dispatch,
    provider,
  ]);
  const clear = useCallback(() => {
    dispatch(resetPools());
  }, [dispatch]);

  const fetch = useMemo(() => throttle(_fetch, 1000), [_fetch]);

  return [fetch, clear];
};

// ------------------------------------------

const PoolsUpdater = () => {
  const [fetch, clear] = useFetchPools();

  useEffect(() => {
    clear();
    fetch();
  }, [fetch, clear]);

  // useTimedRefresh(fetch, 15_000, true, true);

  return null;
};

export default PoolsUpdater;
