import { Token } from "src/classes/Token";
import { TokenValue } from "src/TokenValue";
import { DepositCrate, Silo } from "../silo";

/**
 * Selects the number of crates needed to add up to the desired `amount`.
 */
export function pickCrates(crates: DepositCrate[], amount: TokenValue, token: Token, currentSeason: number) {
  let totalAmount = TokenValue.ZERO;
  let totalBDV = TokenValue.ZERO;
  let totalStalk = TokenValue.ZERO;
  const cratesToWithdrawFrom: DepositCrate[] = [];

  crates.some((crate) => {
    const amountToRemoveFromCrate = totalAmount.add(crate.amount).lte(amount) ? crate.amount : amount.sub(totalAmount);
    const elapsedSeasons = currentSeason - crate.season.toNumber();
    const cratePct = amountToRemoveFromCrate.div(crate.amount);
    const crateBDV = cratePct.mul(crate.bdv);
    const crateSeeds = cratePct.mul(crate.seeds);
    const baseStalk = token.getStalk(crateBDV);
    const grownStalk = crateSeeds.mul(elapsedSeasons).mul(Silo.STALK_PER_SEED_PER_SEASON);
    const crateStalk = baseStalk.add(grownStalk);

    totalAmount = totalAmount.add(amountToRemoveFromCrate);
    totalBDV = totalBDV.add(crateBDV);
    totalStalk = totalStalk.add(crateStalk);

    cratesToWithdrawFrom.push({
      season: crate.season,
      amount: amountToRemoveFromCrate,
      bdv: crateBDV,
      stalk: crateStalk,
      baseStalk: baseStalk,
      grownStalk: grownStalk,
      seeds: crateSeeds
    });

    return totalAmount.eq(amount);
  });

  if (totalAmount.lt(amount)) {
    throw new Error("Not enough deposits");
  }

  return {
    totalAmount,
    totalBDV,
    totalStalk,
    crates: cratesToWithdrawFrom
  };
}
