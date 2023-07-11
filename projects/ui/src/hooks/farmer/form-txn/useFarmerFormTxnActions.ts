import { useFormikContext } from 'formik';
import { useCallback, useMemo } from 'react';
import { Action } from '@reduxjs/toolkit';
import { FarmToMode, FarmFromMode } from '@beanstalk/sdk';
import useFarmerFormTxnsSummary from './useFarmerFormTxnsSummary';
import { FormTokenStateNew, FormTxnsFormState } from '~/components/Common/Form';
import useSdk from '~/hooks/sdk';
import { ActionType } from '~/util';
import { ZERO_BN } from '~/constants';
import useAccount from '~/hooks/ledger/useAccount';
import { FormTxn } from '~/lib/Txn';

const isClaimingBeansAction = (action: FormTxn) =>
  action === FormTxn.HARVEST || action === FormTxn.RINSE;

export default function useFarmerFormTxnsActions(options?: {
  showGraphicOnClaim?: boolean | undefined;
  claimBeansState?: FormTokenStateNew | undefined;
}) {
  const sdk = useSdk();
  const { values } = useFormikContext<FormTxnsFormState>();
  const { summary } = useFarmerFormTxnsSummary();
  const account = useAccount();

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

  const transferAction = useMemo(() => {
    if (!options?.claimBeansState || !account) return undefined;
    const claimableBeans = options.claimBeansState;
    const usedFromClaim = claimableBeans.amount;
    const claimAmount = claimableBeans.maxAmountIn;
    const transferTo = values.farmActions.transferToMode;
    const transferAmount = claimAmount?.minus(usedFromClaim || ZERO_BN);

    if (transferTo === FarmToMode.EXTERNAL && transferAmount?.gt(0)) {
      const transfer = {
        type: ActionType.TRANSFER_BALANCE,
        amount: transferAmount,
        token: sdk.tokens.BEAN,
        source: FarmFromMode.INTERNAL,
        destination: FarmToMode.EXTERNAL,
        to: account,
      };

      return transfer;
    }
    return undefined;
  }, [
    account,
    options?.claimBeansState,
    sdk.tokens.BEAN,
    values.farmActions.transferToMode,
  ]);

  const txnActions = useMemo(() => {
    const primary = values.farmActions.primary;
    const secondary = values.farmActions.secondary;

    const actions = getTxnActions(
      primary,
      secondary,
      options?.showGraphicOnClaim
    );

    if (transferAction) {
      return {
        ...actions,
        postActions: [transferAction, ...actions.postActions],
      };
    }

    return actions;
  }, [
    getTxnActions,
    options?.showGraphicOnClaim,
    transferAction,
    values.farmActions.primary,
    values.farmActions.secondary,
  ]);

  return txnActions;
}
