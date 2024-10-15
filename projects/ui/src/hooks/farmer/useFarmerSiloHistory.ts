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
import useFarmerBalancesBreakdown from './useFarmerBalancesBreakdown';

const useFarmerSiloHistory = (
  account: string | undefined,
  itemizeByToken: boolean = false,
  includeStalk: boolean = false
) => {
  const breakdown = useFarmerBalancesBreakdown();

  const siloRewardsQuery = useFarmerSiloRewardsQuery({
    variables: { account: account || '' },
    skip: !account,
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'beanstalk_eth' },
  });
  const siloAssetsQuery = useFarmerSiloAssetSnapshotsQuery({
    variables: { account: account || '' },
    skip: !account,
    fetchPolicy: 'cache-and-network',
    context: { subgraph: 'beanstalk_eth' },
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
    queryConfig,
    'both'
  );

  /// Interpolate
  const depositData = useInterpolateDeposits(
    siloAssetsQuery,
    priceQuery,
    itemizeByToken
  );
  // const depositDataL1 = useInterpolateDeposits(
  //   siloAssetsQueryL1,
  //   priceQuery,
  //   itemizeByToken
  // )
  // const [stalkDataL1, seedsDataL1, grownStalkDataL1] = useInterpolateStalk(
  //   siloRewardsQueryL1,
  //   seedsPerTokenQueryL1,
  //   !includeStalk
  // )

  const [stalkData, seedsData, grownStalkData] = useInterpolateStalk(
    siloRewardsQuery,
    seedsPerTokenQuery,
    !includeStalk
  );

  const withCurrSeasonDepositsData = useMemo(() => {
    if (!depositData.length) return depositData;
    const copy = [...depositData];

    const baseDataPoint = { ...copy[copy.length - 1] };
    baseDataPoint.value = breakdown.states.deposited.value.toNumber();
    if (itemizeByToken) {
      Object.entries(breakdown.states.deposited.byToken).forEach(
        ([tk, { value }]) => {
          if (tk in baseDataPoint) {
            baseDataPoint[tk] = value.toNumber();
          }
        }
      );
    }

    copy[copy.length - 1] = baseDataPoint;
    return copy;
  }, [
    breakdown.states.deposited.byToken,
    breakdown.states.deposited.value,
    itemizeByToken,
    depositData,
  ]);

  return {
    // remove the current season's data
    data: {
      deposits: withCurrSeasonDepositsData,
      stalk: stalkData,
      seeds: seedsData,
      grownStalk: grownStalkData,
    },
    loading:
      siloRewardsQuery.loading || siloAssetsQuery.loading || priceQuery.loading,
    // || breakdown hasn't loaded value yet
  };
};

export default useFarmerSiloHistory;
