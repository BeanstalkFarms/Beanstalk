import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useFarmerSiloRewardsQuery, useWhitelistTokenRewardsQuery } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { AppState } from '~/state';
import { interpolateFarmerStalk } from '~/util/Interpolate';
import useSdk from '../sdk';

const useInterpolateStalk = (
  siloRewardsQuery: ReturnType<typeof useFarmerSiloRewardsQuery>,
  whitelistQuery: ReturnType<typeof useWhitelistTokenRewardsQuery>,
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
    if (skip || !season.gt(0) || !siloRewardsQuery.data?.snapshots?.length || !whitelistQuery.data?.snapshots?.length)
      return [[], []];
    const siloSnapshots = siloRewardsQuery.data.snapshots;
    const whitelistSnapshots = whitelistQuery.data.snapshots;
    return interpolateFarmerStalk(siloSnapshots, whitelistSnapshots, season, undefined, balances, sdk);
  }, [skip, siloRewardsQuery.data?.snapshots, whitelistQuery.data?.snapshots, season, balances, sdk]);
};

export default useInterpolateStalk;
