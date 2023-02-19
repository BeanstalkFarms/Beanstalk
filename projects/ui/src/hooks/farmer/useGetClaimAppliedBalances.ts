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

  const { getClaimableAmount } = useFarmerClaimPlantOptions();

  const balance: Record<string, ApplicableBalance> = useMemo(() => {
    const usingInternal = balanceSource !== BalanceFrom.EXTERNAL;

    const total = getClaimableAmount(allOptions);
    const applied = getClaimableAmount(selectedOptions);

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
    getClaimableAmount,
    sdk.tokens.BEAN.address,
  ]);

  return balance;
}
