import { useQuery } from '@tanstack/react-query';
import { ABISnippets, ZERO_BN } from '~/constants';
import { multicall } from '@wagmi/core';
import { config } from '~/util/wagmi/config';
import BigNumber from 'bignumber.js';
import { toBNWithDecimals } from '../../util/BigNumber';
import useSdk from '../sdk';
import useSeason from './useSeason';

const makeMultiCall = (beanstalkAddress: string, pools: string[]) => {
  const calls = pools.map((pool) => ({
    address: beanstalkAddress as `0x{string}`,
    abi: ABISnippets.poolDeltaB,
    functionName: 'poolDeltaB',
    args: [pool],
  }));

  return calls;
};

/**
 * use this to calculate twa deltaB.
 * Remove this once misc improvements bip passes & call beanstalk.getTotalDeltaB() instead
 */
const useTwaDeltaB = () => {
  const sdk = useSdk();
  const season = useSeason();

  const query = useQuery({
    queryKey: ['beanstalk', 'twaDeltaB', season.toString()],
    queryFn: async () => {
      const whitelist = sdk.tokens.siloWhitelistedWellLPAddresses;

      const results = await multicall(config, {
        contracts: makeMultiCall(sdk.contracts.beanstalk.address, whitelist),
      });

      const struct = whitelist.reduce<{
        deltaBs: Record<string, BigNumber>;
        total: BigNumber;
      }>(
        (prev, curr, i) => {
          const result = results[i];

          if (!result.error && result.result) {
            const poolDeltaB = toBNWithDecimals(
              result.result.toString(),
              sdk.tokens.BEAN.decimals
            );
            prev.deltaBs[curr] = poolDeltaB;
            prev.total = prev.total.plus(poolDeltaB);
          }

          return prev;
        },
        { deltaBs: {}, total: ZERO_BN }
      );
      return struct;
    },
  });

  return query;
};

export default useTwaDeltaB;
