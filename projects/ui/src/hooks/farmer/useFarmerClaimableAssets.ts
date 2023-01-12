import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import Token from '~/classes/Token';
import { ZERO_BN } from '~/constants';
import { BEAN, PODS, SPROUTS } from '~/constants/tokens';
import useFarmerSilo from '~/hooks/farmer/useFarmerSilo';
import useFarmerFertilizer from './useFarmerFertilizer';
import useFarmerField from './useFarmerField';

export type FarmerClaimableAsset = {
  /**
   * claimable token
   */
  token: Token;
  /**
   * amount of claimable token
   */
  amount: BigNumber;
  /**
   * string description of claimable token
   */
  description: string;
};

/**
 *
 * @returns a map of claimable assets for the current farmer
 * this is used to display claimable assets for Claim and Do x
 */
export default function useFarmerClaimableAssets() {
  const farmerBarn = useFarmerFertilizer();
  const farmerField = useFarmerField();
  const farmerSilo = useFarmerSilo();

  const bean = BEAN[1];
  const sprouts = SPROUTS;
  const pods = PODS;

  return useMemo(() => {
    // use symbol here b/c SPROUTS & PODS don't have an address
    const claimableBean = farmerSilo.balances[bean.address]?.claimable?.amount;
    const claimableSprouts = farmerBarn.fertilizedSprouts;
    const havestablePods = farmerField.harvestablePods;
    return {
      [sprouts.symbol]: {
        amount: claimableSprouts?.gt(0) ? claimableSprouts : ZERO_BN,
        token: sprouts,
        description: 'Rinsable Sprouts',
      },
      [pods.symbol]: {
        amount: havestablePods?.gt(0) ? havestablePods : ZERO_BN,
        token: pods,
        description: 'Harvestable Pods',
      },
      [bean.symbol]: {
        amount: claimableBean?.gt(0) ? claimableBean : ZERO_BN,
        token: bean,
        description: 'Claimable Beans',
      },
    };
  }, [
    farmerSilo.balances,
    bean,
    farmerBarn.fertilizedSprouts,
    farmerField.harvestablePods,
    sprouts,
    pods,
  ]);
}
