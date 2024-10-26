import { ContractTransaction } from "ethers";
import { Token } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { Deposit } from "../silo/types";
import { sortCratesByStem } from "./utils";
import { pickCrates } from "./utils";
import { FarmToMode } from "src/lib/farm";

export class Withdraw {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Withdraw.sdk = sdk;
  }

  async withdraw(
    token: Token,
    amount: TokenValue,
    toMode: FarmToMode = FarmToMode.INTERNAL
  ): Promise<ContractTransaction> {
    Withdraw.sdk.debug("silo.withdraw()", { token, amount });
    if (!Withdraw.sdk.tokens.siloWhitelist.has(token)) {
      throw new Error(`Withdraw error; token ${token.symbol} is not a whitelisted asset`);
    }

    const balance = await Withdraw.sdk.silo.getBalance(token);
    Withdraw.sdk.debug("silo.withdraw(): deposited balance", { balance });

    if (balance.amount.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    const season = await Withdraw.sdk.sun.getSeason();

    const withdrawData = this.calculateWithdraw(token, amount, balance.deposits, season);
    Withdraw.sdk.debug("silo.withdraw(): withdrawData", { withdrawData });

    const stems = withdrawData.crates.map((crate) => crate.stem.toString());
    const amounts = withdrawData.crates.map((crate) => crate.amount.toBlockchain());

    let contractCall;

    if (stems.length === 0) {
      throw new Error("Malformatted crates");
    }

    if (stems.length === 1) {
      Withdraw.sdk.debug("silo.withdraw(): withdrawDeposit()", {
        address: token.address,
        stem: stems[0],
        amount: amounts[0]
      });
      contractCall = Withdraw.sdk.contracts.beanstalk.withdrawDeposit(
        token.address,
        stems[0],
        amounts[0],
        toMode
      );
    } else {
      Withdraw.sdk.debug("silo.withdraw(): withdrawDeposits()", {
        address: token.address,
        stems: stems,
        amounts: amounts
      });
      contractCall = Withdraw.sdk.contracts.beanstalk.withdrawDeposits(
        token.address,
        stems,
        amounts,
        toMode
      );
    }

    return contractCall;
  }

  calculateWithdraw(token: Token, amount: TokenValue, crates: Deposit[], season: number) {
    if (crates.length === 0) throw new Error("No crates to withdraw from");

    const sortedCrates = sortCratesByStem(crates, "desc");
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
