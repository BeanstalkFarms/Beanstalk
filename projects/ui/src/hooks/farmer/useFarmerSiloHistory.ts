import { useMemo } from 'react';
import {
  SeasonalInstantPriceDocument,
  useFarmerSiloAssetSnapshotsQuery,
  useFarmerSiloRewardsQuery,
  useWhitelistTokenRewardsQuery,
} from '~/generated/graphql';
import useSeasonsQuery, {
  SeasonRange,
} from '~/hooks/beanstalk/useSeasonsQuery';
import useInterpolateDeposits from '~/hooks/farmer/useInterpolateDeposits';
import useInterpolateStalk from '~/hooks/farmer/useInterpolateStalk';

const useFarmerSiloHistory = (
  account: string | undefined,
  itemizeByToken: boolean = false,
  includeStalk: boolean = false
) => {
  /// Data
  const siloRewardsQuery = useFarmerSiloRewardsQuery({
    variables: { account: account || '' },
    skip: !account,
    fetchPolicy: 'cache-and-network',
  });
  const siloAssetsQuery = useFarmerSiloAssetSnapshotsQuery({
    variables: { account: account || '' },
    skip: !account,
    fetchPolicy: 'cache-and-network',
  });
  const seedsPerTokenQuery = useWhitelistTokenRewardsQuery({
    fetchPolicy: 'cache-and-network',
  });

  const queryConfig = useMemo(
    () => ({
      variables: { season_gte: 1 },
      context: { subgraph: 'bean' },
    }),
    []
  );

  const priceQuery = useSeasonsQuery(
    SeasonalInstantPriceDocument,
    SeasonRange.ALL,
    queryConfig
  );

  /// Interpolate
  const depositData = useInterpolateDeposits(
    siloAssetsQuery,
    priceQuery,
    itemizeByToken
  );
  const [stalkData, seedsData, grownStalkData] = useInterpolateStalk(
    siloRewardsQuery,
    seedsPerTokenQuery,
    !includeStalk
  );

  return {
    // remove the current season's data
    data: {
      deposits: (depositData || []).slice(0, -1),
      stalk: (stalkData || []).slice(0, -1),
      seeds: (seedsData || []).slice(0, -1),
      grownStalk: (grownStalkData || []).slice(0, -1),
    },
    loading:
      siloRewardsQuery.loading || siloAssetsQuery.loading || priceQuery.loading,
    // || breakdown hasn't loaded value yet
  };
};

export default useFarmerSiloHistory;
