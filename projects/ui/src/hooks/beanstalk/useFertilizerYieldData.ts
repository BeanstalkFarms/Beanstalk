import { useEffect, useMemo } from 'react';
import BigNumber from 'bignumber.js';

import { useFertilizerYieldQuery } from '~/generated/graphql';
import useSeason from './useSeason';

export default function useFertilizerYieldData() {
  // Beanstalk State
  const season = useSeason();

  // Query
  const { data: queryData, previousData, refetch } = useFertilizerYieldQuery({
    variables: { season: season.toString() },
    fetchPolicy: 'network-only',
    notifyOnNetworkStatusChange: true,
  });

  const yieldData = useMemo(() => {
    // If query is fetching, return previous data to prevent 'undefined' being returned. 
    // This prevents components from unmounting and remounting when data is fetched.
    const data = queryData?.fertilizerYield || previousData?.fertilizerYield;
    if (!data) return undefined;
    return {
      season: new BigNumber(data.season),
      vApy: new BigNumber(data.simpleAPY).times(100),
      beansPerSeasonEMA: new BigNumber(data.beansPerSeasonEMA),
    };
  }, [previousData, queryData?.fertilizerYield]);

  useEffect(() => {
    if (yieldData?.season && !yieldData.season.isEqualTo(season)) {
      refetch({ season: season.toString() });
    }
  }, [refetch, season, yieldData?.season]);

  return yieldData;
}
