import { ContractTransaction } from "ethers";
import { Token } from "src/classes/Token";
import { TokenValue } from "src/classes/TokenValue";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { DepositCrate, Silo } from "../silo";
import { sortCratesBySeason } from "../silo.utils";
import { pickCrates } from "./utils";

export class Withdraw {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Withdraw.sdk = sdk;
  }

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

  calculateWithdraw(token: Token, amount: TokenValue, crates: DepositCrate[], season: number) {
    if (crates.length === 0) throw new Error("No crates to withdraw from");

    const sortedCrates = sortCratesBySeason(crates, "desc");
    const pickedCrates = pickCrates(sortedCrates, amount, token, season);

    return {
      amount: pickedCrates.totalAmount,
      bdv: pickedCrates.totalBDV,
      stalk: pickedCrates.totalStalk,
      seeds: token.getSeeds(pickedCrates.totalBDV),
      actions: [],
      crates: pickedCrates.crates
    };
  }
}
