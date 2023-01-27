import { ContractTransaction } from "ethers";
import { Token } from "src/classes/Token";
import { TokenValue } from "src/classes/TokenValue";
import { BeanstalkSDK, DataSource } from "../BeanstalkSDK";
import { FarmToMode } from "../farm";
import { DepositCrate, Silo } from "../silo";
import { sortCratesBySeason } from "../silo.utils";

export class Claim {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Claim.sdk = sdk;
  }

  /**
   * Returns the claimable amount for the given whitelisted token, and the underlying crates
   * @param token Which Silo token to withdraw. Must be a whitelisted token
   * @param dataSource Dictates where to lookup the available claimable amount, subgraph vs onchain
   */
  async getClaimableAmount(token: Token, dataSource?: DataSource) {
    this.validate(token);
    const { claimable } = await Claim.sdk.silo.getBalance(token, undefined, dataSource && { source: dataSource });

    return claimable;
  }

  /**
   * Claims all claimable amount of the given whitelisted token
   * @param token Which Silo token to withdraw. Must be a whitelisted token
   * @param dataSource Dictates where to lookup the available claimable amount, subgraph vs onchain
   * @param toMode Where to send the output tokens (circulating or farm balance)
   */
  async claim(token: Token, dataSource?: DataSource, toMode: FarmToMode = FarmToMode.EXTERNAL) {
    this.validate(token);
    const { crates } = await this.getClaimableAmount(token, dataSource);

    const seasons = crates.map((c) => c.season.toString());

    return this.claimSeasons(token, seasons, toMode);
  }

  /**
   * Claims specific seasons from Silo claimable amount.
   * @param token Which Silo token to withdraw. Must be a whitelisted token
   * @param seasons Which seasons to claim, from the available claimable list. List of seasons
   * can be retrieved with .getClaimableAmount()
   * @param toMode Where to send the output tokens (circulating or farm balance)
   */
  async claimSeasons(token: Token, seasons: string[], toMode: FarmToMode = FarmToMode.EXTERNAL) {
    this.validate(token);
    const { crates } = await this.getClaimableAmount(token);
    const availableSeasons = crates.map((c) => c.season.toString());
    seasons.forEach((season) => {
      if (!availableSeasons.includes(season)) {
        throw new Error(`Season ${season} is not a valid claimable seasons`);
      }
    });

    return seasons.length === 1
      ? Claim.sdk.contracts.beanstalk.claimWithdrawal(token.address, seasons[0], toMode)
      : Claim.sdk.contracts.beanstalk.claimWithdrawals(token.address, seasons, toMode);
  }

  validate(token: Token) {
    if (!Claim.sdk.tokens.siloWhitelist.has(token)) {
      throw new Error("Token is not whitelisted");
    }
  }
}
