import { SeasonalPriceDocument, useFarmerSiloAssetSnapshotsQuery, useFarmerSiloRewardsQuery } from '~/generated/graphql';
import useSeasonsQuery, { SeasonRange } from '~/hooks/beanstalk/useSeasonsQuery';
import useInterpolateDeposits from '~/hooks/farmer/useInterpolateDeposits';
import useInterpolateStalk from '~/hooks/farmer/useInterpolateStalk';

const useFarmerSiloHistory = (
  account: string | undefined,
  itemizeByToken: boolean = false,
  includeStalk: boolean = false,
) => {
  /// Data
  const siloRewardsQuery = useFarmerSiloRewardsQuery({ variables: { account: account || '' }, skip: !account, fetchPolicy: 'cache-and-network' });
  const siloAssetsQuery = useFarmerSiloAssetSnapshotsQuery({ variables: { account: account || '' }, skip: !account, fetchPolicy: 'cache-and-network' });
  const priceQuery = useSeasonsQuery(SeasonalPriceDocument, SeasonRange.ALL);

  /// Interpolate
  const depositData = useInterpolateDeposits(siloAssetsQuery, priceQuery, itemizeByToken);
  const [stalkData, seedsData] = useInterpolateStalk(siloRewardsQuery, !includeStalk);

  return {
    data: {
      deposits: depositData,
      stalk: stalkData,
      seeds: seedsData,
    },
    loading: (
      siloRewardsQuery.loading
      || siloAssetsQuery.loading 
      || priceQuery.loading
      // || breakdown hasn't loaded value yet
    )
  };
};

export default useFarmerSiloHistory;
