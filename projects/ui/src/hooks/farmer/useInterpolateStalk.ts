import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useFarmerSiloRewardsQuery } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { AppState } from '~/state';
import { interpolateFarmerStalk } from '~/util/Interpolate';
import useSdk from '../sdk';

const useInterpolateStalk = (
  siloRewardsQuery: ReturnType<typeof useFarmerSiloRewardsQuery>,
  skip: boolean = false
) => {
  const season = useSeason();
  const sdk = useSdk();

  // Balances
  const balances = useSelector<
    AppState,
    AppState['_farmer']['silo']['balances']
  >((state) => state._farmer.silo.balances);

  return useMemo(() => {
    if (skip || !season.gt(0) || !siloRewardsQuery.data?.snapshots?.length)
      return [[], []];
    const snapshots = siloRewardsQuery.data.snapshots;
    return interpolateFarmerStalk(snapshots, season, undefined, balances, sdk);
  }, [skip, siloRewardsQuery.data?.snapshots, season, balances, sdk]);
};

export default useInterpolateStalk;
