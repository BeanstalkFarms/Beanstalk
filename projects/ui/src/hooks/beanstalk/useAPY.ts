import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useLatestApyQuery } from '~/generated/graphql';

type APY = {
  bean: BigNumber;
  stalk: BigNumber;
};

type APYs = {
  beansPerSeasonEMA24h?: BigNumber;
  beansPerSeasonEMA7d?: BigNumber;
  beansPerSeasonEMA30d?: BigNumber;
  byToken: Record<string, Partial<Record<'24h' | '7d' | '30d', APY>>>;
};

export default function useAPY() {
  const apyQuery = useLatestApyQuery({
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-first',
  });

  return useMemo(() => {
    const periods = [
      ['24h', 'beansPerSeasonEMA24h', apyQuery.data?.day?.[0]],
      ['7d', 'beansPerSeasonEMA7d', apyQuery.data?.week?.[0]],
      ['30d', 'beansPerSeasonEMA30d', apyQuery.data?.month?.[0]],
    ] as const;
    const apys: APYs = { byToken: {} };
    periods.forEach(([period, emaKey, snapshot]) => {
      if (!snapshot) return;
      apys[emaKey] = new BigNumber(snapshot.beansPerSeasonEMA);
      snapshot.tokenAPYS.forEach((tokenAPY) => {
        const token = tokenAPY.token;
        apys.byToken[token] = {
          ...apys.byToken[token],
          [period]: {
            bean: new BigNumber(tokenAPY.beanAPY),
            stalk: new BigNumber(tokenAPY.stalkAPY),
          },
        };
      });
    });

    return {
      loading: apyQuery.loading,
      error: apyQuery.error,
      data: periods.some(([, , snapshot]) => snapshot) ? apys : undefined,
    };
  }, [apyQuery]);
}
