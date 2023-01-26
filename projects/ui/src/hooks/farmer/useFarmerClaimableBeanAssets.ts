import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { FarmFromMode } from '@beanstalk/sdk';
import { ZERO_BN } from '~/constants';

import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import useFarmerFertilizer from './useFarmerFertilizer';
import useFarmerField from './useFarmerField';
import { ClaimableBeanAssetFragment } from '~/components/Common/Form';
import useSdk from '../sdk';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';

export enum ClaimableBeanToken {
  BEAN = 'BEAN',
  SPROUTS = 'SPROUTS',
  PODS = 'PODS',
}

const normalize = (v: BigNumber | undefined) => (v && v.gt(0) ? v : ZERO_BN);

export const balanceFromToMode = (from: BalanceFrom) => {
  switch (from) {
    case BalanceFrom.EXTERNAL:
      return FarmFromMode.EXTERNAL;
    case BalanceFrom.INTERNAL:
      return FarmFromMode.INTERNAL;
    default:
      return FarmFromMode.INTERNAL_EXTERNAL;
  }
};

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
  const sdk = useSdk();
  const farmerBarn = useFarmerFertilizer();
  const farmerField = useFarmerField();
  const farmerSilo = useFarmerSilo();

  return useMemo(() => {
    const claimableBean = normalize(
      farmerSilo.balances[sdk.tokens.BEAN.address]?.claimable?.amount
    );
    const claimableSprouts = normalize(farmerBarn.fertilizedSprouts);
    const havestablePods = normalize(farmerField.harvestablePods);

    // use symbol here b/c SPROUTS & PODS don't have an address
    return {
      total: claimableBean.plus(claimableSprouts.plus(havestablePods)),
      assets: {
        [ClaimableBeanToken.SPROUTS]: {
          token: sdk.tokens.SPROUTS,
          amount: claimableSprouts,
        },
        [ClaimableBeanToken.PODS]: {
          token: sdk.tokens.PODS,
          amount: havestablePods,
        },
        [ClaimableBeanToken.BEAN]: {
          token: sdk.tokens.BEAN,
          amount: claimableBean,
        },
      },
    };
  }, [
    farmerSilo.balances, 
    farmerBarn.fertilizedSprouts, 
    farmerField.harvestablePods, 
    sdk.tokens.SPROUTS, 
    sdk.tokens.PODS, 
    sdk.tokens.BEAN
  ]);
}
