import { TokenValue, Token as CoreToken } from "@beanstalk/sdk-core";
import { BigNumber, ContractTransaction } from "ethers";

const STALK_DECIMALS = 10;
const SEED_DECIMALS = 6;

declare module "@beanstalk/sdk-core" {
  interface Token {
    isUnripe: boolean;
    rewards?: { stalk: TokenValue; seeds: TokenValue | null };
    getStalk(bdv?: TokenValue): TokenValue;
    getSeeds(bdv?: TokenValue): TokenValue;
    approveBeanstalk(amount: TokenValue | BigNumber): Promise<ContractTransaction>;
  }

  namespace Token {
    let _source: string;
  }
}

// Adding the static Token._source property
Object.defineProperty(CoreToken, "_source", {
  value: "BeanstalkSDK",
  writable: false,
  configurable: false,
  enumerable: true
});

// define property Token.prototype.isUnripe
Object.defineProperty(CoreToken.prototype, "isUnripe", {
  value: false,
  writable: true,
  configurable: true
});

// define property Token.prototype.rewards
Object.defineProperty(CoreToken.prototype, "rewards", {
  value: undefined,
  writable: true,
  configurable: true
});

/**
 * Get the amount of Stalk rewarded per deposited BDV of this Token.
 */
CoreToken.prototype.getStalk = function (bdv?: TokenValue): TokenValue {
  if (!this.rewards?.stalk) return TokenValue.fromHuman(0, STALK_DECIMALS);
  if (!bdv) return this.rewards?.stalk;

  return this.rewards.stalk.mul(bdv);
};

/**
 * Get the amount of Seeds rewarded per deposited BDV of this Token.
 * */
CoreToken.prototype.getSeeds = function (bdv?: TokenValue): TokenValue {
  if (this.rewards?.seeds === undefined || this.rewards.seeds === null) {
    throw new Error(`Token ${this.symbol} has no seeds defined!`);
  }
  if (!bdv) return this.rewards.seeds;

  return this.rewards.seeds.mul(bdv);
};

CoreToken.prototype.approveBeanstalk = function (
  amount: TokenValue | BigNumber
): Promise<ContractTransaction> {
  // @ts-ignore
  return;
};

export type Token = InstanceType<typeof CoreToken>;
export const Token = CoreToken;
