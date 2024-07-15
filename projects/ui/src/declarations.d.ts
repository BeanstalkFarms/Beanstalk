import { TokenValue } from '@beanstalk/sdk';
import { BigNumber, ContractTransaction } from 'ethers';

declare module '@beanstalk/sdk-core' {
  interface Token {
    isUnripe: boolean;
    rewards?: { stalk: TokenValue; seeds: TokenValue | null };
    getStalk(bdv?: TokenValue): TokenValue;
    getSeeds(bdv?: TokenValue): TokenValue;
    approveBeanstalk(
      amount: TokenValue | BigNumber
    ): Promise<ContractTransaction>;
  }

  namespace Token {
    let _source: string;
  }
}
