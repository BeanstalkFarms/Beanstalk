import { useFormikContext } from 'formik';
import { useMemo } from 'react';
import { BalanceFrom } from '~/components/Common/Form/BalanceFromRow';
import {
  BalanceFromFragment,
  FormTxnsFormState,
} from '~/components/Common/Form';
import { ZERO_BN } from '~/constants';
import useSdk from '~/hooks/sdk';
import { ApplicableBalance } from '~/state/farmer/balances';
import useFarmerFormTxnsSummary from './useFarmerFormTxnsSummary';
import { FormTxn, FormTxnBuilderPresets } from '~/util/FormTxns';

type FormContext = FormTxnsFormState & Partial<BalanceFromFragment>;

export default function useFarmerFormTxnBalances() {
  const sdk = useSdk();
  const { values } = useFormikContext<FormContext>();
  const { summary, getClaimable } = useFarmerFormTxnsSummary();

  const beanAddress = sdk.tokens.BEAN.address;

  const balances: Record<string, ApplicableBalance> = useMemo(() => {
    const preset = FormTxnBuilderPresets[values.farmActions.preset];
    const { farmActions, balanceFrom } = values;
    const usingInternal = balanceFrom !== BalanceFrom.EXTERNAL;

    const total = getClaimable(preset.primary).bn;
    const applied = getClaimable(farmActions.primary).bn;

    return {
      [beanAddress]: {
        total: usingInternal ? total : ZERO_BN,
        applied: usingInternal ? applied : ZERO_BN,
        remaining: usingInternal ? total.minus(applied) : ZERO_BN,
      },
    };
  }, [values, getClaimable, beanAddress]);

  const plantableBalance: Record<string, ApplicableBalance> = useMemo(() => {
    const data = summary[FormTxn.PLANT];
    const amount = data.summary[0].amount || ZERO_BN;

    const { farmActions } = values;
    const isPlanting = farmActions.primary?.includes(FormTxn.PLANT);

    return {
      [beanAddress]: {
        total: isPlanting ? amount : ZERO_BN,
        applied: isPlanting ? amount : ZERO_BN,
        remaining: isPlanting ? ZERO_BN : amount,
      },
    };
  }, [beanAddress, summary, values]);

  return {
    balances,
    plantableBalance,
  };
}
