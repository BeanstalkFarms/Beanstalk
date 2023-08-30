import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useLatestApyQuery } from '~/generated/graphql';

type APY = {
  bean: BigNumber;
  stalk: BigNumber;
};

type APYs = {
  beansPerSeasonEMA: BigNumber;
  bySeeds: {
    '3': APY;
    '3.25': APY;
    '4.5': APY;
  };
};

export default function useAPY() {
  const query = useLatestApyQuery({
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
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
            3: {
              bean: new BigNumber(siloYield.threeSeedBeanAPY),
              stalk: new BigNumber(siloYield.threeSeedStalkAPY),
            },
            3.25: {
              bean: new BigNumber(siloYield.threePointTwoFiveSeedBeanAPY),
              stalk: new BigNumber(siloYield.threePointTwoFiveSeedStalkAPY),
            },
            4.5: {
              bean: new BigNumber(siloYield.fourPointFiveSeedBeanAPY),
              stalk: new BigNumber(siloYield.fourPointFiveSeedStalkAPY),
            },
          },
        } as APYs,
      };
    }
    return {
      loading: query.loading,
      error: query.error,
      data: undefined,
    };
  }, [query]);
}
