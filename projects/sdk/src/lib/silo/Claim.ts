import { ContractTransaction } from "ethers";
import { Token } from "src/classes/Token";
import { BeanstalkSDK, DataSource } from "../BeanstalkSDK";
import { FarmToMode } from "../farm";
import { TokenSiloBalance } from "../silo";

export class Claim {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    Claim.sdk = sdk;
  }

  async getClaimableAmount(token: Token, dataSource?: DataSource): Promise<TokenSiloBalance["claimable"]> {
    this.validate(token);
    const { claimable } = await Claim.sdk.silo.getBalance(token, undefined, dataSource && { source: dataSource });

    return claimable;
  }

  async claim(token: Token, dataSource?: DataSource, toMode: FarmToMode = FarmToMode.EXTERNAL): Promise<ContractTransaction> {
    this.validate(token);
    const { crates } = await this.getClaimableAmount(token, dataSource);

    const seasons = crates.map((c) => c.season.toString());

    return this.claimSeasons(token, seasons, toMode);
  }

  async claimSeasons(token: Token, seasons: string[], toMode: FarmToMode = FarmToMode.EXTERNAL): Promise<ContractTransaction> {
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
