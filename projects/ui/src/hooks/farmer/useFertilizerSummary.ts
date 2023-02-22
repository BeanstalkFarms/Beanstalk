import BigNumber from 'bignumber.js';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import { FormTokenStateNew } from '~/components/Common/Form';
import useHumidity from '~/hooks/beanstalk/useHumidity';
import { Action, ActionType } from '~/util/Actions';

/**
 * Summarize the Actions that will occur when making a Deposit.
 * This includes pre-deposit Swaps, the Deposit itself, and resulting
 * rewards provided by Beanstalk depending on the destination of Deposit.
 * 
 * @param to A whitelisted Silo Token which the Farmer is depositing to.
 * @param tokens Token form state.
 */
export default function useFertilizerSummary(
  tokens: FormTokenStateNew[]
) {
  const sdk = useSdk();
  const usdc = sdk.tokens.USDC;
  const [humidity] = useHumidity();
  const summary = tokens.reduce((agg, curr) => {
    const amount = (
      usdc.equals(curr.token)
        ? curr.amount
        : curr.amountOut
    );
    if (amount) {
      agg.usdc = agg.usdc.plus(amount);
      if (curr.amount && curr.amountOut) {
        agg.actions.push({
          type: ActionType.SWAP,
          tokenIn: getNewToOldToken(curr.token),
          tokenOut: getNewToOldToken(usdc),
          amountIn: curr.amount,
          amountOut: curr.amountOut,
        });
      }
    }
    return agg;
  }, {
    usdc:     new BigNumber(0),  // The amount of USDC to be swapped for FERT.
    fert:     new BigNumber(0),
    humidity: humidity,          //
    actions:  [] as Action[],    // 
  });

  // 
  summary.fert = summary.usdc.dp(0, BigNumber.ROUND_DOWN);

  summary.actions.push({
    type: ActionType.BUY_FERTILIZER,
    amountIn: summary.fert,
    humidity,
  });
  summary.actions.push({
    type: ActionType.RECEIVE_FERT_REWARDS,
    amountOut: humidity.plus(1).times(summary.fert),
  });

  return summary;
}
