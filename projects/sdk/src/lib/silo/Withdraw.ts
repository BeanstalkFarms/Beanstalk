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

  /**
   * Initates a withdraw from the silo. The `token` specified dictates which silo to withdraw
   * from, and therefore is limited to only whitelisted assets.
   * Behind the scenes, the `amount` to be withdrawn must be taken from individual
   * deposits, aka crates. A user's deposits are not summarized into one large bucket, from
   * which we can withdraw at will. Each deposit is independently tracked, so each withdraw must
   * calculate how many crates it must span to attain the desired `amount`.
   * @param token The whitelisted token to withdraw. ex, BEAN vs BEAN_3CRV_LP
   * @param amount The desired amount to withdraw. Must be 0 < amount <= total deposits for token
   * @returns Promise of Transaction
   */
  async withdraw(token: Token, amount: TokenValue): Promise<ContractTransaction> {
    Withdraw.sdk.debug("silo.withdraw()", { token, amount });
    if (!Withdraw.sdk.tokens.siloWhitelist.has(token)) {
      throw new Error(`Withdraw error; token ${token.symbol} is not a whitelisted asset`);
    }

    const { deposited } = await Withdraw.sdk.silo.getBalance(token);
    Withdraw.sdk.debug("silo.withdraw(): deposited balance", { deposited });

    if (deposited.amount.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    const season = await Withdraw.sdk.sun.getSeason();

    const withdrawData = this.calculateWithdraw(token, amount, deposited.crates, season);
    Withdraw.sdk.debug("silo.withdraw(): withdrawData", { withdrawData });

    const seasons = withdrawData.crates.map((crate) => crate.season.toString());
    const amounts = withdrawData.crates.map((crate) => crate.amount.toBlockchain());

    let contractCall;

    if (seasons.length === 0) {
      throw new Error("Malformatted crates");
    }

    if (seasons.length === 1) {
      Withdraw.sdk.debug("silo.withdraw(): withdrawDeposit()", { address: token.address, season: seasons[0], amount: amounts[0] });
      contractCall = Withdraw.sdk.contracts.beanstalk.withdrawDeposit(token.address, seasons[0], amounts[0]);
    } else {
      Withdraw.sdk.debug("silo.withdraw(): withdrawDeposits()", { address: token.address, seasons: seasons, amounts: amounts });
      contractCall = Withdraw.sdk.contracts.beanstalk.withdrawDeposits(token.address, seasons, amounts);
    }

    return contractCall;
  }

  /**
   * This methods figures out which deposits, or crates, the withdraw must take from
   * in order to reach the desired amount. It returns extra information that may be useful
   * in a UI to show the user how much stalk and seed they will forfeit as a result of the withdraw
   */
  calculateWithdraw(token: Token, amount: TokenValue, crates: DepositCrate[], season: number) {
    if (crates.length === 0) throw new Error("No crates to withdraw from");

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

    return {
      totalAmount,
      totalBDV,
      totalStalk,
      crates: cratesToWithdrawFrom
    };
  }
}
