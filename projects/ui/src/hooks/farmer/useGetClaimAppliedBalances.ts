import { useMemo } from 'react';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import { ZERO_BN } from '~/constants';
import useSdk from '~/hooks/sdk';
import { ApplicableBalance } from '~/state/farmer/balances';
import { ClaimPlantAction } from '../beanstalk/useClaimAndPlantActions';
import useFarmerClaimPlantOptions from './useFarmerClaimAndPlantOptions';

export default function useGetClaimAppliedBalances(
  allOptions: ClaimPlantAction[],
  selectedOptions: ClaimPlantAction[],
  balanceSource: BalanceFrom
) {
  const sdk = useSdk();

  const { getBeansClaiming } = useFarmerClaimPlantOptions();

  const balance: Record<string, ApplicableBalance> = useMemo(() => {
    const usingInternal = balanceSource !== BalanceFrom.EXTERNAL;

    const total = getBeansClaiming(allOptions).bn;
    const applied = getBeansClaiming(selectedOptions).bn;

    return {
      [sdk.tokens.BEAN.address]: {
        total: usingInternal ? total : ZERO_BN,
        applied: usingInternal ? applied : ZERO_BN,
        remaining: usingInternal ? total.minus(applied) : ZERO_BN,
      },
    };
  }, [
    allOptions,
    balanceSource,
    selectedOptions,
    sdk.tokens.BEAN.address,
    getBeansClaiming,
  ]);

  return balance;
}
