import BigNumber from 'bignumber.js';

export type BeanstalkField = {
  /**
   * The number of Pods that have become Harvestable.
   */
  harvestableIndex: BigNumber;
  /**
   * The total number of Pods ever minted.
   */
  podIndex: BigNumber;
  /**
   * The current length of the Pod Line.
   * podLine = podIndex - harvestableIndex.
   */
  podLine: BigNumber;
  /**
   * The total number of Pods ever minted.
   * `totalPods = podIndex + harvestableIndex`
   */
  // totalPods: BigNumber;
  /**
   * The amount of available Soil.
   */
  soil: BigNumber;
  /**
   * Facets of the Weather.
   * The commonly-addressed numerical value for "Weather" is
   * called `yield`. Other parameters are used to determine the
   * change in the Weather yield and available Soil over time.
   */
  weather: {
    didSowBelowMin: boolean;
    didSowFaster: boolean;
    lastDSoil: BigNumber;
    lastSoilPercent: BigNumber;
    lastSowTime: BigNumber;
    nextSowTime: BigNumber;
    startSoil: BigNumber;
    yield: BigNumber;
  };

  // ------------------------------------------

  rain: {
    /** Whether it is raining or not. */
    raining: Boolean;
    /** The season that it started raining. */
    rainStart: BigNumber;
  }
}
