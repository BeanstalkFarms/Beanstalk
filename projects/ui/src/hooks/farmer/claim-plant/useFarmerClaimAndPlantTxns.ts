import { useFormikContext } from 'formik';
import { useMemo } from 'react';
import { ClaimAndPlantFormState } from '~/components/Common/Form';
import useFarmerClaimAndPlantOptions from './useFarmerClaimPlantOptions';

export default function useFarmerClaimAndPlantTxns(
  graphicOnClaimBeans?: boolean | undefined
) {
  const { values } = useFormikContext<ClaimAndPlantFormState>();
  const { getTxnActions } = useFarmerClaimAndPlantOptions();

  return useMemo(() => {
    const primary = values.farmActions.selected;
    const secondary = values.farmActions.additional;

    return getTxnActions(primary, secondary, graphicOnClaimBeans);
  }, [
    getTxnActions,
    graphicOnClaimBeans,
    values.farmActions.additional,
    values.farmActions.selected,
  ]);
}
