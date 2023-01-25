import { ContractTransaction } from "ethers";
import { Token } from "src/classes/Token";
import { TokenValue } from "src/classes/TokenValue";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { DepositCrate, Silo } from "../silo";
import { sortCratesBySeason } from "../silo.utils";

export class Withdraw {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Withdraw.sdk = sdk;
  }

  async withdraw(token: Token, amount: TokenValue): Promise<ContractTransaction> {
    if (!Withdraw.sdk.tokens.siloWhitelist.has(token)) {
      throw new Error(`Withdraw error; token ${token.symbol} is not a whitelisted asset`);
    }

    const { deposited } = await Withdraw.sdk.silo.getBalance(token);
    if (deposited.amount.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    const season = await Withdraw.sdk.sun.getSeason();

    const withdrawData = this.calculateWithdraw(token, amount, deposited.crates, season);

    const seasons = withdrawData.crates.map((crate) => crate.season.toString());
    const amounts = withdrawData.crates.map((crate) => crate.amount.toBlockchain());
    let call;
    if (seasons.length === 0) {
      throw new Error("Malformatted crates");
    }

    if (seasons.length === 1) {
      call = Withdraw.sdk.contracts.beanstalk.withdrawDeposit(token.address, seasons[0], amounts[0]);
    } else {
      call = Withdraw.sdk.contracts.beanstalk.withdrawDeposits(token.address, seasons, amounts);
    }

    return call;
  }

  calculateWithdraw(token: Token, amount: TokenValue, crates: DepositCrate[], season: number) {
    const sortedCrates = sortCratesBySeason(crates, "desc");
    const pickedCrates = this.pickCrates(sortedCrates, amount, token, season);

    return {
      amount: pickedCrates.totalAmount,
      bdv: pickedCrates.totalBDV,
      stalk: pickedCrates.totalStalk,
      seeds: token.getSeeds(pickedCrates.totalBDV),
      actions: [],
      crates: pickedCrates.crates
    };
  }

  /**
   * Selects the number of crates needed to add up to the desired `amount`.
   * @param crates A list of crates from which to pick
   * @param amount The target amount
   * @param token The whitelisted token the crates represent
   * @param currentSeason The current season
   */
  pickCrates(crates: DepositCrate[], amount: TokenValue, token: Token, currentSeason: number) {
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

      // Stalk is removed for two reasons:
      //  'base stalk' associated with the initial deposit is forfeited
      //  'grown stalk' earned from Seeds over time is forfeited.
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

      // Finish when...
      return totalAmount.eq(amount);
    });

    return {
      totalAmount,
      totalBDV,
      totalStalk,
      crates: cratesToWithdrawFrom
    };
  }
}
