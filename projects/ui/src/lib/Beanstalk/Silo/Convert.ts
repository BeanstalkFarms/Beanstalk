import BigNumber from 'bignumber.js';
import { Token } from '~/classes';
import { LegacyDepositCrate } from '~/state/farmer/silo';
import { sortCratesByBDVRatio, sortCratesBySeason } from './Utils';
import { STALK_PER_SEED_PER_SEASON } from '~/util';

export enum ConvertKind {
  BEANS_TO_CURVE_LP = 0,
  CURVE_LP_TO_BEANS = 1,
  UNRIPE_BEANS_TO_LP = 2,
  UNRIPE_LP_TO_BEANS = 3,
}

/**
 * @deprecated Use SDK function instead.
 *
 * Select Deposit Crates to convert. Calculate resulting gain/loss of Stalk and Seeds.
 *
 * @param fromToken Token converting from. Used to calculate stalk and seeds.
 * @param toToken Token converting to. Used to calculate stalk and seeds.
 * @param fromAmount Amount of `fromToken` to convert.
 * @param depositedCrates An array of deposit crates for `fromToken`.
 * @param currentSeason used to calculate loss of grown stalk.
 * @returns
 */
export function selectCratesToConvert(
  fromToken: Token,
  toToken: Token,
  fromAmount: BigNumber,
  depositedCrates: LegacyDepositCrate[],
  currentSeason: BigNumber
) {
  let totalAmountConverted = new BigNumber(0);
  let totalBDVRemoved = new BigNumber(0);
  let totalStalkRemoved = new BigNumber(0);
  const deltaCrates: LegacyDepositCrate[] = [];

  /// TODO: handle the LP->LP case when we have two LP pools.
  const sortedCrates = toToken.isLP
    ? /// BEAN -> LP: oldest crates are best. Grown stalk is equivalent
      /// on both sides of the convert, but having more seeds in older crates
      /// allows you to accrue stalk faster after convert.
      /// Note that during this convert, BDV is approx. equal after the convert.
      sortCratesBySeason<LegacyDepositCrate>(depositedCrates, 'asc')
    : /// LP -> BEAN: use the crates with the lowest [BDV/Amount] ratio first.
      /// Since LP deposits can have varying BDV, the best option for the Farmer
      /// is to increase the BDV of their existing lowest-BDV crates.
      sortCratesByBDVRatio<LegacyDepositCrate>(depositedCrates, 'asc');

  /// FIXME: symmetry with `Withdraw`
  sortedCrates.some((crate) => {
    // How much to remove from the current crate.
    const isPartialRemove = totalAmountConverted
      .plus(crate.amount)
      .isLessThanOrEqualTo(fromAmount);
    const crateAmountToRemove = isPartialRemove
      ? crate.amount // remove the entire crate
      : fromAmount.minus(totalAmountConverted); // remove the remaining amount

    const elapsedSeasons = currentSeason.minus(crate.season); //
    const cratePctToRemove = crateAmountToRemove.div(crate.amount); // (0, 1]
    const crateBDVToRemove = cratePctToRemove.times(crate.bdv); //
    const crateSeedsToRemove = cratePctToRemove.times(crate.seeds); //

    // Stalk is removed for two reasons:
    //  'base stalk' associated with the initial deposit is forfeited
    //  'accrued stalk' earned from Seeds over time is forfeited.
    const baseStalkToRemove = fromToken.getStalk(crateBDVToRemove); // more or less, BDV * 1
    const accruedStalkToRemove = crateSeedsToRemove
      .times(elapsedSeasons)
      .times(STALK_PER_SEED_PER_SEASON);
    const crateStalkToRemove = baseStalkToRemove.plus(accruedStalkToRemove);

    // Update totals
    totalAmountConverted = totalAmountConverted.plus(crateAmountToRemove);
    totalBDVRemoved = totalBDVRemoved.plus(crateBDVToRemove);
    totalStalkRemoved = totalStalkRemoved.plus(crateStalkToRemove);

    deltaCrates.push({
      season: crate.season,
      amount: crateAmountToRemove.negated(),
      bdv: crateBDVToRemove.negated(),
      stalk: crateStalkToRemove.negated(),
      seeds: crateSeedsToRemove.negated(),
    });

    // Finish when...
    return totalAmountConverted.isEqualTo(fromAmount);
  });

  return {
    /** change in amount of fromToken */
    deltaAmount: totalAmountConverted.negated(),
    /** the total change in bdv from this convert */
    deltaBDV: totalBDVRemoved.negated(),
    /** stalk gained/lost during the convert */
    deltaStalk: totalStalkRemoved.negated(),
    /** affected crates */
    deltaCrates,
  };
}

/**
 * @deprecated Use SDK function instead.
 */
export function convert(
  fromToken: Token,
  toToken: Token,
  fromAmount: BigNumber,
  depositedCrates: LegacyDepositCrate[],
  currentSeason: BigNumber
) {
  const { deltaAmount, deltaBDV, deltaStalk, deltaCrates } =
    selectCratesToConvert(
      fromToken,
      toToken,
      fromAmount,
      depositedCrates,
      currentSeason
    );

  return {
    amount: deltaAmount,
    bdv: deltaBDV,
    stalk: deltaStalk,
    seeds: fromToken.getSeeds(deltaBDV),
    actions: [],
    deltaCrates,
  };
}
