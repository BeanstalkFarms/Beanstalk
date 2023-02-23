import { useFormikContext } from 'formik';
import { useMemo } from 'react';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import { BalanceFromFragment, ClaimAndPlantFormState } from '~/components/Common/Form';
import { ZERO_BN } from '~/constants';
import useSdk from '~/hooks/sdk';
import { ApplicableBalance } from '~/state/farmer/balances';
import useFarmerClaimPlantOptions from './useFarmerClaimPlantOptions';

type FormContext = ClaimAndPlantFormState & BalanceFromFragment

export default function useFarmerClaimingBalance() {
  const sdk = useSdk();
  const { values } = useFormikContext<FormContext>();
  const { getClaimable } = useFarmerClaimPlantOptions();

  const balance: Record<string, ApplicableBalance> = useMemo(() => {
    const { farmActions, balanceFrom } = values;
    const usingInternal = balanceFrom !== BalanceFrom.EXTERNAL;

    const total = getClaimable(farmActions.options).bn;
    const applied = getClaimable(farmActions.selected).bn;

    return {
      [sdk.tokens.BEAN.address]: {
        total: usingInternal ? total : ZERO_BN,
        applied: usingInternal ? applied : ZERO_BN,
        remaining: usingInternal ? total.minus(applied) : ZERO_BN,
      },
    };
  }, [values, getClaimable, sdk.tokens.BEAN.address]);

  return balance;
}
