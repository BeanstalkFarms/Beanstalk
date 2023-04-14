import BigNumber from 'bignumber.js';
import { Token } from '~/classes';
import { FormState } from '~/components/Common/Form';
import { Action, ActionType } from '~/util/Actions';
import { ZERO_BN } from '~/constants';

/**
 * Summarize the Actions that will occur when making a Deposit.
 * This includes pre-deposit Swaps, the Deposit itself, and resulting
 * rewards provided by Beanstalk depending on the destination of Deposit.
 * 
 * @param to A Whitelisted Silo Token which the Farmer is Depositing.
 * @param tokens Input Tokens to Deposit. Could be multiple Tokens.
 */
export function deposit(
  to: Token,
  tokens: FormState['tokens'],
  amountToBDV: (amount: BigNumber) => BigNumber,
) {
  const summary = tokens.reduce((agg, curr) => {
    /// If we're doing a "direct deposit", (ex. deposit BEAN into the Silo) 
    /// then no swap occurs and the amount deposited = the amount entered.
    /// If we're doing a "swap and deposit" (ex. swap ETH for BEAN and deposit into the Silo)
    /// then `amountOut` contains the amount of BEAN corresponding to the input amount of ETH.
    /// this is the asset that is actually deposited.
    const amount = (
      curr.token === to
        ? curr.amount
        : curr.amountOut
    );

    if (amount) {
      // AMOUNT + BDV
      // FIXME: the below is only the case for BEAN deposits. Need a generalized
      //        way to calculate this regardless of token.
      const bdv  = amountToBDV(amount);
      agg.amount = agg.amount.plus(amount);
      agg.bdv    = agg.bdv.plus(bdv);

      // REWARDS
      // NOTE: this is a function of `to.rewards.stalk` for the destination token.
      // we could pull it outside the reduce function.
      // however I expect we may need to adjust this when doing withdrawals/complex swaps
      // when bdv does not always go up during an Action. -SC
      agg.stalk = agg.stalk.plus(to.getStalk(bdv));
      agg.seeds = agg.seeds.plus(to.getSeeds(bdv));
      
      // INSTRUCTIONS
      if (curr.amount && curr.amountOut) {
        agg.actions.push({
          type: ActionType.SWAP,
          tokenIn: curr.token,
          tokenOut: to,
          amountIn: curr.amount,
          amountOut: curr.amountOut,
        });
      }
    }
    
    return agg;
  }, {  
    amount: ZERO_BN, //
    bdv:    ZERO_BN, // The aggregate BDV to be Deposited.
    stalk:  ZERO_BN, // The Stalk earned for the Deposit.
    seeds:  ZERO_BN, // The Seeds earned for the Deposit.
    actions: [] as Action[],
  });

  // DEPOSIT and RECEIVE_REWARDS always come last
  summary.actions.push({
    type: ActionType.DEPOSIT,
    amount: summary.amount,
    // from the perspective of the deposit, the token is "coming in".
    token: to, 
  });
  summary.actions.push({
    type: ActionType.UPDATE_SILO_REWARDS,
    stalk: summary.stalk,
    seeds: summary.seeds,
  });

  return summary;
}
