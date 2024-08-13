import BigNumber from 'bignumber.js';

export * from './reducer';

export type BeanstalkCaseState = {
  deltaPodDemand: BigNumber;
  l2sr: BigNumber;
  podRate: BigNumber;
  largestLiqWell: string;
  oracleFailure: boolean;
};

export type BeanstalkCaseTime = {
  /**
   * timestamp in which the data was last fetched
   */
  time: number;
  /**
   * season in which the data was last fetched
   */
  season: BigNumber;
};
