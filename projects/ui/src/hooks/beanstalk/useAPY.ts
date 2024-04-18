import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useLatestApyQuery } from '~/generated/graphql';

type APY = {
  bean: BigNumber;
  stalk: BigNumber;
};

type APYs = {
  beansPerSeasonEMA: BigNumber;
  byToken: {
    [token: string]: APY;
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

      const apys: APYs = {
        beansPerSeasonEMA: new BigNumber(siloYield.beansPerSeasonEMA),
        byToken: {},
      };

      siloYield.tokenAPYS.forEach((tokenAPY) => {
        const apy: APY = {
          bean: new BigNumber(tokenAPY.beanAPY),
          stalk: new BigNumber(tokenAPY.stalkAPY),
        };

        apys.byToken[tokenAPY.token] = apy;
      });

      return {
        loading: query.loading,
        error: undefined,
        data: apys as APYs,
      };
    }

    return {
      loading: query.loading,
      error: query.error,
      data: undefined,
    };
  }, [query]);
}
