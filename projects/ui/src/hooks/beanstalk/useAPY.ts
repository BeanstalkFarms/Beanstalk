import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useLatestApyQuery } from '~/generated/graphql';

type APY = {
  bean: BigNumber;
  stalk: BigNumber;
}

type APYs = {
  beansPerSeasonEMA: BigNumber;
  bySeeds: {
    '2': APY;
    '4': APY;
  }
}

export default function useAPY() {
  const query = useLatestApyQuery({ 
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first'
  });
  return useMemo(() => {
    if (query.data?.siloYields?.[0]) {
      const siloYield = query.data.siloYields[0];
      return {
        loading: query.loading,
        error: undefined,
        data: {
          beansPerSeasonEMA: new BigNumber(siloYield.beansPerSeasonEMA),
          bySeeds: {
            2: {
              bean:  new BigNumber(siloYield.twoSeedBeanAPY),
              stalk: new BigNumber(siloYield.twoSeedStalkAPY),
            },
            4: {
              bean:  new BigNumber(siloYield.fourSeedBeanAPY),
              stalk: new BigNumber(siloYield.fourSeedStalkAPY),
            }
          }
        } as APYs
      };
    }
    return {
      loading: query.loading,
      error: query.error,
      data: undefined,
    };
  }, [query]);
}
