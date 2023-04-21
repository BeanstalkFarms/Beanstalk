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
    lastDSoil: BigNumber;
    lastSowTime: BigNumber;
    thisSowTime: BigNumber;
  };

  temperature: {
    /** The max temperature for this season. */
    max: BigNumber;
    /** adjusted temperature for this season */
    morning: BigNumber;
  };
};
