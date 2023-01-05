import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useFarmerSiloAssetSnapshotsQuery, useSeasonalPriceQuery } from '~/generated/graphql';
import { AppState } from '~/state';
import { interpolateFarmerDepositedValue, SnapshotBeanstalk } from '~/util/Interpolate';

const useInterpolateDeposits = (
  siloAssetsQuery: ReturnType<typeof useFarmerSiloAssetSnapshotsQuery>,
  priceQuery: ReturnType<typeof useSeasonalPriceQuery>,
  itemizeByToken: boolean = false
) => {
  const unripe = useSelector<AppState, AppState['_bean']['unripe']>((state) => state._bean.unripe);
  return useMemo(() => {
    if (
      priceQuery.loading
      || !priceQuery.data?.seasons?.length
      || !siloAssetsQuery.data?.farmer?.silo?.assets.length
      || Object.keys(unripe).length === 0
    ) {
      return [];
    }

    // Convert the list of assets => snapshots into one snapshot list
    // sorted by Season and normalized based on chop rate.
    const snapshots = siloAssetsQuery.data.farmer.silo.assets.reduce((prev, asset) => {
      const tokenAddress = asset.token.toLowerCase();
      prev.push(
        ...asset.hourlySnapshots.map((snapshot) => ({
          ...snapshot,
          // For Unripe tokens, derive the "effective BDV" using the Chop Rate.
          // Instead of using the BDV that Beanstalk honors for Stalk/Seeds, we calculate the BDV
          // that would (approximately) match the value of the assets if they were chopped.
          hourlyDepositedBDV: (
            // NOTE: this isn't really true since it uses the *instantaneous* chop rate,
            // and the BDV of an unripe token isn't necessarily equal to this. but this matches
            // up with what the silo table below the overview shows.
            unripe[tokenAddress]
              ? new BigNumber(snapshot.deltaDepositedAmount).times(unripe[tokenAddress].chopRate)
              : snapshot.deltaDepositedBDV
          )
        }))
      );
      return prev;
    }, [] as SnapshotBeanstalk[]).sort((a, b) => a.season - b.season);

    return interpolateFarmerDepositedValue(snapshots, priceQuery.data.seasons, itemizeByToken);
  }, [priceQuery.loading, priceQuery?.data?.seasons, siloAssetsQuery?.data?.farmer?.silo?.assets, unripe, itemizeByToken]);
};

export default useInterpolateDeposits;
