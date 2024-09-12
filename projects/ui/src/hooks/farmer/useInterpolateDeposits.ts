import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import {
  useFarmerSiloAssetSnapshotsQuery,
  useSeasonalInstantPriceQuery,
} from '~/generated/graphql';
import { useAppSelector } from '~/state';
import {
  interpolateFarmerDepositedValue,
  SnapshotBeanstalk,
} from '~/util/Interpolate';
import { SupportedChainId, ZERO_BN } from '~/constants';
import { UNRIPE_BEAN_WSTETH } from '~/constants/tokens';
import useUnripeUnderlyingMap from '../beanstalk/useUnripeUnderlying';

const useInterpolateDeposits = (
  siloAssetsQuery: ReturnType<typeof useFarmerSiloAssetSnapshotsQuery>,
  priceQuery: ReturnType<typeof useSeasonalInstantPriceQuery>,
  itemizeByToken: boolean = false
) => {
  const unripe = useAppSelector((state) => state._bean.unripe);
  const beanPools = useAppSelector((state) => state._bean.pools);
  const underlyingMap = useUnripeUnderlyingMap();

  // const sdk = useSdk();
  // BS3TODO: fix me
  const urBeanLP = UNRIPE_BEAN_WSTETH[SupportedChainId.ETH_MAINNET];

  return useMemo(() => {
    if (
      priceQuery.loading ||
      !priceQuery.data?.seasons?.length ||
      !siloAssetsQuery.data?.farmer?.silo?.assets.length ||
      Object.keys(unripe).length === 0
    ) {
      return [];
    }

    // Convert the list of assets => snapshots into one snapshot list
    // sorted by Season and normalized based on chop rate.
    const snapshots = siloAssetsQuery.data.farmer.silo.assets
      .reduce((prev, asset) => {
        const tokenAddress = asset.token.toLowerCase();
        prev.push(
          ...asset.hourlySnapshots.map((snapshot) => {
            let hourlyDepositedBDV;

            if (tokenAddress in unripe) {
              if (
                tokenAddress.toLowerCase() === urBeanLP.address.toLowerCase()
              ) {
                // formula: penalty = amount of BEANwstETH per 1 urBEANwstETH.
                // bdv of urBEANwstETH = amount * penalty * BDV of 1 BEANwstETH
                const underlying = underlyingMap[tokenAddress];
                const underlyingBDV =
                  beanPools[underlying.address]?.lpBdv || ZERO_BN;

                const lpAmount = new BigNumber(snapshot.deltaDepositedAmount);
                const choppedLP = lpAmount.times(
                  unripe[tokenAddress]?.penalty || 0
                );

                hourlyDepositedBDV = underlyingBDV.times(choppedLP);
              } else {
                hourlyDepositedBDV = new BigNumber(
                  snapshot.deltaDepositedAmount
                ).times(unripe[tokenAddress].chopRate);
              }
            } else {
              hourlyDepositedBDV = new BigNumber(snapshot.deltaDepositedBDV);
            }

            return {
              ...snapshot,
              // For Unripe tokens, derive the "effective BDV" using the Chop Rate.
              // Instead of using the BDV that Beanstalk honors for Stalk/Seeds, we calculate the BDV
              // that would (approximately) match the value of the assets if they were chopped.
              hourlyDepositedBDV: hourlyDepositedBDV.toString(),
              // NOTE: this isn't really true since it uses the *instantaneous* chop rate,
              // and the BDV of an unripe token isn't necessarily equal to this. but this matches
              // up with what the silo table below the overview shows.
            };
          })
        );
        return prev;
      }, [] as SnapshotBeanstalk[])
      .sort((a, b) => a.season - b.season);

    return interpolateFarmerDepositedValue(
      snapshots,
      priceQuery.data.seasons,
      itemizeByToken
    );
  }, [
    priceQuery.loading,
    priceQuery.data?.seasons,
    siloAssetsQuery.data?.farmer?.silo?.assets,
    unripe,
    itemizeByToken,
    urBeanLP.address,
    underlyingMap,
    beanPools,
  ]);
};

export default useInterpolateDeposits;
