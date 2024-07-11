import { TokenValue, BigNumber, ContractTransaction } from "@beanstalk/sdk-core";

declare module "@beanstalk/sdk-core" {
  interface Token {
    isUnripe: boolean;
    rewards?: { stalk: TokenValue; seeds: TokenValue | null };
    getStalk(bdv?: TokenValue): TokenValue;
    getSeeds(bdv?: TokenValue): TokenValue;
    approveBeanstalk(amount: TokenValue | BigNumber): Promise<ContractTransaction>;
  }

  namespace token {
    let _source: string;
  }
}
