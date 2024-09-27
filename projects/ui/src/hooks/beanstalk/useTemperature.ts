import BigNumber from 'bignumber.js';
import { useCallback, useMemo } from 'react';
import { ONE_BN, ZERO_BN } from '~/constants';
import { useAppSelector } from '~/state';
import {
  APPROX_L2_BLOCK_PER_L1_BLOCK,
  INTERVALS_PER_MORNING,
} from '~/state/beanstalk/sun/morning';

// Constants
export const TEMPERATURE_DECIMALS = 6;

export const TEMPERATURE_LOG_BASE = 3.5;

export const TEMPERATURE_PRECISION = 1e6;

export const L1_BLOCK_TIME = 1200;

export const L2_BLOCK_TIME = 25;

/**
 * @see LibDibbler.sol
 * 1200 / 25 = 48
 *
 * L1 block = 12 seconds & L2 block = ~0.25 seconds
 * 48 L2 blocks = 1 L1 block
 */

export type MorningBlockTemperature = {
  /** */
  temperature: BigNumber;
  /** */
  maxTemperature: BigNumber;
  /** */
  interval: BigNumber;
  /** */
  blockNumber: BigNumber;
};

export type MorningTemperatureMap = {
  [blockNumber: string]: MorningBlockTemperature;
};

/**
 * NOTES: @Bean-Sama
 *
 * In a perfect world, we could just use the temperature stored on-chain by calling 'Beanstalk.temperature()';
 * however, there are times when the update we receive from the RPC provider lags 3-6 seconds behind.
 *
 * The formula used to calculate the scaled temperature is:
 *
 * =================================================================
 * || temperature = log3.5(0.1 * deltaBlocks + 1) * maxTemperature ||
 * =================================================================
 *
 * where: 'deltaBlocks' is scaled down to L1 block time as L2 block time is significantly shorter.
 *
 * Occasionally, when applying the formula, there can be a discrepancy of approximately 1e-6 compared to
 * the temperature obtained from the on-chain data due to rounding. To ensure precise results, we choose
 * to calculate the scaled temperature using the same method as the contract. By adopting this approach, we
 * eliminate the need to retrieve the temperature from the contract for each block during the Morning.
 *
 * Refer 'morningTemperature()'in 'Beanstalk/protocol/contracts/libraries/LibDibbler.sol'.
 *
 * Additional Notes:
 *
 * It is recommended to use this hook to read the current temperature of the field
 * instead of using the temperature stored in the redux store.
 */

/**
 * indexes in terms of L1 blocks
 */
const DELTA_TEMPERATURE_PCTS: Record<number, number> = {
  0: TEMPERATURE_PRECISION,
  1: 76079978576,
  2: 145535557307,
  3: 209428496104,
  4: 268584117732,
  5: 323656683909,
  6: 375173629062,
  7: 423566360442,
  8: 469192241217,
  9: 512350622036,
  10: 553294755665,
  11: 592240801642,
  12: 629374734241,
  13: 664857713614,
  14: 698830312972,
  15: 731415882267,
  16: 762723251769,
  17: 792848925126,
  18: 821878873397,
  19: 849890014127,
  20: 876951439574,
  21: 903125443474,
  22: 928468384727,
  23: 953031418151,
  24: 976861116107,
};

const scaleTemperature = (_pct: BigNumber, _maxTemperature: BigNumber) => {
  if (_maxTemperature.eq(0)) {
    return ZERO_BN;
  }
  const pct = new BigNumber(_pct).div(TEMPERATURE_PRECISION);
  const temperature = pct.times(_maxTemperature).div(TEMPERATURE_PRECISION);
  return temperature.decimalPlaces(6, BigNumber.ROUND_CEIL);
};

const getMorningTemperature = (
  delta: BigNumber, // in terms of L1 blocks
  maxTemperature: BigNumber
) => {
  const _deltaKey = delta.toNumber();

  if (_deltaKey in DELTA_TEMPERATURE_PCTS) {
    const pct = DELTA_TEMPERATURE_PCTS[delta.toNumber()];

    const scaledTemperature = scaleTemperature(
      new BigNumber(pct),
      maxTemperature
    );

    return BigNumber.max(scaledTemperature, ONE_BN);
  }
  return maxTemperature;
};

// get the key in terms of L1 blocks
const getRelativeBlockKey = (
  blockNumber: BigNumber,
  sunriseBlock: BigNumber
) => {
  const key = blockNumber.minus(sunriseBlock).div(APPROX_L2_BLOCK_PER_L1_BLOCK);
  return key.dp(0, BigNumber.ROUND_DOWN);
};

export default function useTemperature() {
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);
  const season = useAppSelector((s) => s._beanstalk.sun.season);
  const temperature = useAppSelector((s) => s._beanstalk.field.temperature);

  const maxTemperature = temperature.max;
  const sunriseBlock = season.sunriseBlock;
  const morningBlock = morning.blockNumber;
  const isMorning = morning.isMorning;
  const morningIndex = morning.index;

  /**
   * Calculate the temperature of a block during the morning period.
   */
  const calculate = useCallback(
    (_blockNumber: BigNumber = morning.blockNumber) => {
      if (sunriseBlock.lte(0)) return ZERO_BN;
      const key = getRelativeBlockKey(_blockNumber, sunriseBlock);
      return getMorningTemperature(key, maxTemperature);
    },
    [maxTemperature, sunriseBlock, morning.blockNumber]
  );

  const getNextTemperatureWithBlock = useCallback(
    (_blockNumber: BigNumber) => {
      const key = getRelativeBlockKey(_blockNumber, sunriseBlock).plus(1);
      return calculate(key);
    },
    [calculate, sunriseBlock]
  );

  /**
   * Generate a mapping of block numbers to their respective temperatures.
   */
  const generate = useCallback(() => {
    const blocks = Array.from({ length: INTERVALS_PER_MORNING }, (_, i) => i);

    return blocks.reduce<MorningTemperatureMap>((prev, _, index) => {
      const delta = new BigNumber(index);
      const interval = delta.plus(1);

      const blockNumber = sunriseBlock.plus(delta);
      const blockKey = blockNumber.toString();

      prev[blockKey] = {
        interval,
        blockNumber,
        temperature: getMorningTemperature(delta, maxTemperature),
        maxTemperature: maxTemperature,
      };

      return prev;
    }, {});
  }, [maxTemperature, sunriseBlock]);

  /// The current and max temperatures.
  const temperatures = useMemo(() => {
    const current = isMorning ? calculate(morningBlock) : maxTemperature;
    const next =
      isMorning || morningIndex.lt(24)
        ? calculate(morningBlock.plus(1))
        : maxTemperature;

    return {
      current,
      next,
      max: maxTemperature,
    };
  }, [morningBlock, isMorning, calculate, maxTemperature, morningIndex]);

  return [
    temperatures,
    { generate, calculate, getNextTemperatureWithBlock },
  ] as const;
}
