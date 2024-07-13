import { TokenValue } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import useSdk, { getNewToOldToken } from '~/hooks/sdk';
import { FormTokenStateNew } from '~/components/Common/Form';
import useHumidity from '~/hooks/beanstalk/useHumidity';
import { Action, ActionType, SwapAction } from '~/util/Actions';

export type SummaryData = {
  actions: Action[];
  wstETH: BigNumber;
  fert: BigNumber;
  humidity: BigNumber;
};

/**
 * Summarize the Actions that will occur when making a Deposit.
 * This includes pre-deposit Swaps, the Deposit itself, and resulting
 * rewards provided by Beanstalk depending on the destination of Deposit.
 *
 * @param to A whitelisted Silo Token which the Farmer is depositing to.
 * @param tokens Token form state.
 */
export default function useFertilizerSummary(
  tokens: FormTokenStateNew[],
  wstETHPrice: TokenValue
) {
  const sdk = useSdk();

  // const usdc = sdk.tokens.USDC;
  const wstETH = sdk.tokens.WSTETH;
  const eth = sdk.tokens.ETH;
  const [humidity] = useHumidity();

  const buildSummary = () => {
    const _data = tokens.reduce(
      (agg, curr) => {
        // const amount = usdc.equals(curr.token) ? curr.amount : curr.amountOut;
        const amount = wstETH.equals(curr.token) ? curr.amount : curr.amountOut;
        if (amount) {
          // agg.usdc = agg.usdc.plus(amount);
          agg.wstETH = agg.wstETH.plus(amount);
          if (curr.amount && curr.amountOut) {
            const currTokenKey = curr.token.equals(eth)
              ? 'eth'
              : curr.token.address;
            if (currTokenKey in agg.actions) {
              const existing = agg.actions[currTokenKey];
              agg.actions[currTokenKey] = {
                ...existing,
                amountIn: existing.amountIn.plus(amount),
                amountOut: existing.amountOut.plus(curr.amountOut),
              };
            } else {
              agg.actions[currTokenKey] = {
                type: ActionType.SWAP,
                tokenIn: getNewToOldToken(curr.token),
                tokenOut: getNewToOldToken(wstETH),
                amountIn: curr.amount,
                amountOut: curr.amountOut,
              };
            }
          }
        }

        return agg;
      },
      {
        // usdc: new BigNumber(0), // The amount of USD used to buy FERT.
        wstETH: new BigNumber(0), // The amount of wstETH to be swapped for FERT.
        fert: new BigNumber(0),
        humidity: humidity,
        actions: {} as Record<string, SwapAction>,
      }
    );

    return {
      ..._data,
      actions: Object.values(_data.actions) as Action[],
    };
  };

  const data = buildSummary();

  data.fert = data.wstETH
    .multipliedBy(wstETHPrice.toHuman())
    .dp(0, BigNumber.ROUND_DOWN);

  data.actions.push({
    type: ActionType.BUY_FERTILIZER,
    amountIn: data.wstETH,
    amountOut: data.fert,
    humidity,
  });
  data.actions.push({
    type: ActionType.RECEIVE_FERT_REWARDS,
    amountOut: humidity.plus(1).times(data.fert),
  });

  return data;
}
