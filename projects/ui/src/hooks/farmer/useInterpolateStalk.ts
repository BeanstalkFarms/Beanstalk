import { useMemo } from 'react';
import { useFarmerSiloRewardsQuery, useWhitelistTokenRewardsQuery } from '~/generated/graphql';
import useSeason from '~/hooks/beanstalk/useSeason';
import { useAppSelector } from '~/state';
import { interpolateFarmerStalk } from '~/util/Interpolate';
import { useWhitelistedTokens } from '../beanstalk/useTokens';

const useInterpolateStalk = (
  siloRewardsQuery: ReturnType<typeof useFarmerSiloRewardsQuery>,
  whitelistQuery: ReturnType<typeof useWhitelistTokenRewardsQuery>,
  skip: boolean = false
) => {
  const season = useSeason();
  const { whitelist } = useWhitelistedTokens();

  // Balances
  const balances = useAppSelector((state) => state._farmer.silo.balances);

  return useMemo(() => {
    if (skip || !season.gt(0) || !siloRewardsQuery.data?.snapshots?.length || !whitelistQuery.data?.snapshots?.length)
      return [[], []];
    const siloSnapshots = siloRewardsQuery.data.snapshots;
    const whitelistSnapshots = whitelistQuery.data.snapshots;
    return interpolateFarmerStalk(siloSnapshots, whitelistSnapshots, season, undefined, balances, whitelist);
  }, [skip, siloRewardsQuery.data?.snapshots, whitelistQuery.data?.snapshots, season, balances, whitelist]);
};

export default useInterpolateStalk;
