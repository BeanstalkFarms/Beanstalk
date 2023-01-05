import BigNumber from 'bignumber.js';
import { Token } from '~/classes';
import { FormState } from '~/components/Common/Form';
import { DepositCrate } from '~/state/farmer/silo';
import { sortCratesBySeason } from './Utils';

/**
 * Select how much to Withdraw from Crates. Calculate the Stalk and Seeds 
 * lost for Withdrawing the selected Crates.
 * 
 * @returns totalAmountRemoved  
 * @returns totalStalkRemoved   
 * @returns removedCrates       
 */
export function selectCratesToWithdraw(
  token: Token,
  amount: BigNumber,
  depositedCrates: DepositCrate[],
  currentSeason: BigNumber,
) {
  let totalAmountRemoved = new BigNumber(0);
  let totalBDVRemoved    = new BigNumber(0);
  let totalStalkRemoved  = new BigNumber(0);
  const deltaCrates : DepositCrate[] = [];
  const sortedCrates = sortCratesBySeason<DepositCrate>(depositedCrates);

  /// FIXME: symmetry with `Convert`
  sortedCrates.some((crate) => {
    // How much to remove from the current crate.
    const crateAmountToRemove = (
      totalAmountRemoved.plus(crate.amount).isLessThanOrEqualTo(amount)
        ? crate.amount                       // remove the entire crate
        : amount.minus(totalAmountRemoved)   // remove the remaining amount
    );
    const elapsedSeasons      = currentSeason.minus(crate.season);      // 
    const cratePctToRemove    = crateAmountToRemove.div(crate.amount);  // (0, 1]
    const crateBDVToRemove    = cratePctToRemove.times(crate.bdv);      // 
    const crateSeedsToRemove  = cratePctToRemove.times(crate.seeds);    //

    // Stalk is removed for two reasons:
    //  'base stalk' associated with the initial deposit is forfeited
    //  'accrued stalk' earned from Seeds over time is forfeited.
    const baseStalkToRemove     = token.getStalk(crateBDVToRemove); // more or less, BDV * 1
    const accruedStalkToRemove  = crateSeedsToRemove.times(elapsedSeasons).times(0.0001); // FIXME: use constant
    const crateStalkToRemove    = baseStalkToRemove.plus(accruedStalkToRemove);

    // Update totals
    totalAmountRemoved = totalAmountRemoved.plus(crateAmountToRemove);
    totalBDVRemoved    = totalBDVRemoved.plus(crateBDVToRemove);
    totalStalkRemoved  = totalStalkRemoved.plus(crateStalkToRemove);
    deltaCrates.push({
      season: crate.season,
      amount: crateAmountToRemove.negated(),
      bdv:    crateBDVToRemove.negated(),
      stalk:  crateStalkToRemove.negated(),
      seeds:  crateSeedsToRemove.negated(),
    });

    // Finish when...
    return totalAmountRemoved.isEqualTo(amount);
  });

  return {
    deltaAmount: totalAmountRemoved.negated(),
    deltaBDV:    totalBDVRemoved.negated(),
    deltaStalk:  totalStalkRemoved.negated(),
    deltaCrates,
  };
}

/**
 * Summarize the Actions that will occur when making a Withdrawal.
 * This includes pre-deposit Swaps, the Deposit itself, and resulting
 * rewards removed by Beanstalk depending on the destination of Withdrawal.
 * 
 * @param from A Whitelisted Silo Token which the Farmer is Withdrawing.
 * @param tokens Input Tokens to Deposit. Could be multiple Tokens.
 */
export function withdraw(
  from: Token,
  tokens: FormState['tokens'],
  depositedCrates: DepositCrate[],
  currentSeason: BigNumber,
) {
  if (tokens.length > 1) throw new Error('Multi-token Withdrawal is currently not supported.');
  if (!tokens[0].amount) return null;

  const withdrawAmount = tokens[0].amount;
  const {
    deltaAmount,
    deltaBDV,
    deltaStalk,
    deltaCrates
  } = selectCratesToWithdraw(
    from,
    withdrawAmount,
    depositedCrates,
    currentSeason,
  );
  
  return {
    amount: deltaAmount,
    bdv:    deltaBDV,
    stalk:  deltaStalk,
    seeds:  from.getSeeds(deltaBDV),
    actions: [],
    deltaCrates,
  };
}
