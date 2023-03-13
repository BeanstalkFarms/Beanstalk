import { useFormikContext } from 'formik';
import { useCallback, useMemo } from 'react';
import { Action } from '@reduxjs/toolkit';
import { FormTxnsFormState } from '~/components/Common/Form';
import useFarmerFormTxnsSummary from './useFarmerFormTxnsSummary';
import { FormTxn } from '~/util/FormTxns';

const isClaimingBeansAction = (action: FormTxn) => {
  const isClaiming =
    action === FormTxn.CLAIM ||
    action === FormTxn.HARVEST ||
    action === FormTxn.RINSE;

  return isClaiming;
};

export default function useFarmerFormTxnsActions(options?: {
  showGraphicOnClaim?: boolean | undefined;
}) {
  const { values } = useFormikContext<FormTxnsFormState>();
  const { summary } = useFarmerFormTxnsSummary();

  const getTxnActions = useCallback(
    (
      _primary: FormTxn[] | undefined,
      _secondary: FormTxn[] | undefined,
      graphicOnClaimBeans?: boolean
    ) => {
      const primary = _primary || [];
      const secondary = _secondary || [];

      const postStartIndex = primary.length;
      const actions = [...primary, ...secondary].reduce<{
        pre: Action[];
        post: Action[];
        claiming: Action[];
      }>(
        (prev, curr, idx) => {
          const option = summary[curr];
          let _actions;
          if (isClaimingBeansAction(curr)) {
            _actions = option.txActions();
            if (graphicOnClaimBeans) {
              prev.claiming = [...prev.claiming, ..._actions];
            }
          } else {
            _actions = option.txActions();
          }
          if (idx >= postStartIndex) {
            prev.post = [...prev.post, ..._actions];
          } else {
            prev.pre = [...prev.pre, ..._actions];
          }
          return prev;
        },
        { pre: [], post: [], claiming: [] }
      );

      return {
        preActions: actions.pre,
        postActions: actions.post,
        preActionsWithGraphic: actions.claiming,
      };
    },
    [summary]
  );

  const txnActions = useMemo(() => {
    const primary = values.farmActions.primary;
    const secondary = values.farmActions.secondary;

    return getTxnActions(primary, secondary, options?.showGraphicOnClaim);
  }, [
    getTxnActions,
    options?.showGraphicOnClaim,
    values.farmActions.primary,
    values.farmActions.secondary,
  ]);

  return txnActions;
}
