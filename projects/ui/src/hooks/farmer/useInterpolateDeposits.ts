import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useAppSelector } from '~/state';
import {
  interpolateFarmerDepositedValue,
  SnapshotBeanstalk,
} from '~/util/Interpolate';
import { ZERO_BN } from '~/constants';
import { SeasonalInstantPriceQuery } from '~/generated/graphql';
import useUnripeUnderlyingMap from '../beanstalk/useUnripeUnderlying';
import {
  useGetChainAgnosticLegacyToken,
  useHistoricalWhitelistedTokens,
  useUnripeTokens,
} from '../beanstalk/useTokens';
import useSeasonsQuery from '../beanstalk/useSeasonsQuery';
import { useMergedFarmerSiloAssetSnapshotsQuery } from './useFarmerSiloHistory';



const useInterpolateDeposits = (
  siloAssetsQuery: ReturnType<typeof useMergedFarmerSiloAssetSnapshotsQuery>,
  priceQuery: ReturnType<typeof useSeasonsQuery<SeasonalInstantPriceQuery>>,
  itemizeByToken: boolean = false
) => {
  const unripe = useAppSelector((state) => state._bean.unripe);
  const beanPools = useAppSelector((state) => state._bean.pools);
  const { UNRIPE_BEAN_WSTETH: urBeanLP } = useUnripeTokens();
  const normalizeToken = useGetChainAgnosticLegacyToken();
  const whitelist = useHistoricalWhitelistedTokens();
  const underlyingMap = useUnripeUnderlyingMap();

  return useMemo(() => {
    if (
      priceQuery.loading ||
      !priceQuery.data?.seasons?.length ||
      !siloAssetsQuery.data?.length ||
      Object.keys(unripe).length === 0
    ) {
      return [];
    }

    // Convert the list of assets => snapshots into one snapshot list
    // sorted by Season and normalized based on chop rate.
    const snapshots = siloAssetsQuery.data
      .reduce((prev, asset) => {
        const token = normalizeToken(asset.token);
        if (!token) return prev;
        const tokenAddress = token?.address;
        prev.push(
          ...asset.hourlySnapshots.map((snapshot) => {
            let hourlyDepositedBDV;

            if (token.isUnripe) {
              if (tokenAddress === urBeanLP.address) {
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
      itemizeByToken,
      24,
      whitelist,
      normalizeToken
    );
  }, [
    normalizeToken,
    whitelist,
    priceQuery.loading,
    priceQuery.data?.seasons,
    siloAssetsQuery.data,
    unripe,
    itemizeByToken,
    urBeanLP.address,
    underlyingMap,
    beanPools,
  ]);
};

export default useInterpolateDeposits;
