import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useLatestApyQuery } from '~/generated/graphql';

type APY = {
  bean: BigNumber;
  stalk: BigNumber;
};

type APYs = {
  beansPerSeasonEMA24h: BigNumber;
  beansPerSeasonEMA7d: BigNumber;
  beansPerSeasonEMA30d: BigNumber;
  byToken: {
    [token: string]: {
      '24h': APY;
      '7d': APY;
      '30d': APY;
    };
  };
};

export default function useAPY() {
  const apyQuery = useLatestApyQuery({
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return useMemo(() => {
    if (apyQuery.data?.day?.[0]) {
      const siloYield24h = apyQuery.data.day[0];
      const siloYield7d = apyQuery.data.week[0];
      const siloYield30d = apyQuery.data.month[0];

      const apys: APYs = {
        beansPerSeasonEMA24h: new BigNumber(siloYield24h.beansPerSeasonEMA),
        beansPerSeasonEMA7d: new BigNumber(siloYield7d.beansPerSeasonEMA),
        beansPerSeasonEMA30d: new BigNumber(siloYield30d.beansPerSeasonEMA),
        byToken: {},
      };

      const apysByToken: any = {};

      siloYield24h.tokenAPYS.forEach((tokenAPY) => {
        const apy: APY = {
          bean: new BigNumber(tokenAPY.beanAPY),
          stalk: new BigNumber(tokenAPY.stalkAPY),
        };

        apysByToken[tokenAPY.token] = {
          '24h': apy,
        };
      });

      siloYield7d.tokenAPYS.forEach((tokenAPY) => {
        const apy: APY = {
          bean: new BigNumber(tokenAPY.beanAPY),
          stalk: new BigNumber(tokenAPY.stalkAPY),
        };

        apysByToken[tokenAPY.token] = {
          ...apysByToken[tokenAPY.token],
          '7d': apy,
        };
      });

      siloYield30d.tokenAPYS.forEach((tokenAPY) => {
        const apy: APY = {
          bean: new BigNumber(tokenAPY.beanAPY),
          stalk: new BigNumber(tokenAPY.stalkAPY),
        };

        apysByToken[tokenAPY.token] = {
          ...apysByToken[tokenAPY.token],
          '30d': apy,
        };
      });

      apys.byToken = apysByToken;

      return {
        loading: apyQuery.loading,
        error: undefined,
        data: apys as APYs,
      };
    }

    return {
      loading: apyQuery.loading,
      error: apyQuery.error,
      data: undefined,
    };
  }, [apyQuery]);
}
