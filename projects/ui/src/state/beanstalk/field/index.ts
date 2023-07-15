import BigNumberJS from 'bignumber.js';

export type BeanstalkField = {
  /**
   * The number of Pods that have become Harvestable.
   */
  harvestableIndex: BigNumberJS;
  /**
   * The total number of Pods ever minted.
   */
  podIndex: BigNumberJS;
  /**
   * The current length of the Pod Line.
   * podLine = podIndex - harvestableIndex.
   */
  podLine: BigNumberJS;
  /**
   * The total number of Pods ever minted.
   * `totalPods = podIndex + harvestableIndex`
   */
  // totalPods: BigNumber;
  /**
   * The amount of available Soil.
   */
  soil: BigNumberJS;
  /**
   * Facets of the Weather.
   * The commonly-addressed numerical value for "Weather" is
   * called `yield`. Other parameters are used to determine the
   * change in the Weather yield and available Soil over time.
   */
  weather: {
    lastDSoil: BigNumberJS;
    lastSowTime: BigNumberJS;
    thisSowTime: BigNumberJS;
  };

  temperature: {
    /** The max temperature for this season. */
    max: BigNumberJS;
    /** adjusted temperature for this season */
    scaled: BigNumberJS;
  };
};
