import BigNumber from 'bignumber.js';

export type BeanstalkBarn = {
  remaining: BigNumber;
  totalRaised: BigNumber;
  humidity: BigNumber;
  currentBpf: BigNumber;
  endBpf: BigNumber;
  recapFundedPct: BigNumber;

  /**
   * The total number of Unfertilized Sprouts remaining.
   */
  unfertilized: BigNumber;

  /**
   * The total number of Fertilized Sprouts. This is the amount
   * of Fertilizer debt that has been repaid.
   */
  fertilized: BigNumber;
}
