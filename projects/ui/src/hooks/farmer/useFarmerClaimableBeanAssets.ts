import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { ZERO_BN } from '~/constants';
import {
  BEAN as BEAN_T,
  PODS as PODS_T,
  SPROUTS as SPROUTS_T,
} from '~/constants/tokens';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import useFarmerFertilizer from './useFarmerFertilizer';
import useFarmerField from './useFarmerField';
import { ClaimableBeanAssetFragment } from '~/components/Common/Form';

export enum ClaimableBeanToken {
  BEAN = 'BEAN',
  SPROUTS = 'SPROUTS',
  PODS = 'PODS',
}

const normalize = (v: BigNumber | undefined) => (v && v.gt(0) ? v : ZERO_BN);

/**
 * @returns a map of claimable assets for the current farmer
 * this is used to display claimable assets for Claim and Do x
 */
export default function useFarmerClaimableBeanAssets(): {
  /**
   * total amount of claimable beans
   */
  total: BigNumber;
  /**
   * mapping of claimable assets that are 'claimed' in Bean
   */
  assets: Record<ClaimableBeanToken, ClaimableBeanAssetFragment>;
} {
  const farmerBarn = useFarmerFertilizer();
  const farmerField = useFarmerField();
  const farmerSilo = useFarmerSilo();

  return useMemo(() => {
    const claimableBean = normalize(
      farmerSilo.balances[BEAN_T[1].address]?.claimable?.amount
    );
    const claimableSprouts = normalize(farmerBarn.fertilizedSprouts);
    const havestablePods = normalize(farmerField.harvestablePods);

    // use symbol here b/c SPROUTS & PODS don't have an address
    return {
      total: claimableBean.plus(claimableSprouts.plus(havestablePods)),
      assets: {
        [ClaimableBeanToken.SPROUTS]: {
          token: SPROUTS_T,
          amount: claimableSprouts,
        },
        [ClaimableBeanToken.PODS]: {
          token: PODS_T,
          amount: havestablePods,
        },
        [ClaimableBeanToken.BEAN]: {
          token: BEAN_T[1],
          amount: claimableBean,
        },
      },
      // fetch,
    };
  }, [
    // fetch,
    farmerSilo.balances,
    farmerBarn.fertilizedSprouts,
    farmerField.harvestablePods,
  ]);
}
