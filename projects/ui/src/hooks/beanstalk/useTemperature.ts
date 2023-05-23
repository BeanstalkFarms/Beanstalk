import BigNumber from 'bignumber.js';
import { useCallback, useMemo } from 'react';
import { ONE_BN, ZERO_BN } from '~/constants';
import { useAppSelector } from '~/state';
import { BLOCKS_PER_MORNING } from '~/state/beanstalk/sun/morning';

// Constants
export const TEMPERATURE_DECIMALS = 6;
export const TEMPERATURE_LOG_BASE = 51;
export const TEMPERATURE_PRECISION = 1e6;

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
 * ===============================================================
 * || temperature = log51(2 * deltaBlocks + 1) * maxTemperature ||
 * ===============================================================
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

const DELTA_TEMPERATURE_PCTS: Record<number, number> = {
  0: TEMPERATURE_PRECISION,
  1: 279415312704,
  2: 409336034395,
  3: 494912626048,
  4: 558830625409,
  5: 609868162219,
  6: 652355825780,
  7: 688751347100,
  8: 720584687295,
  9: 748873234524,
  10: 774327938752,
  11: 797465225780,
  12: 818672068791,
  13: 838245938114,
  14: 856420437864,
  15: 873382373802,
  16: 889283474924,
  17: 904248660443,
  18: 918382006208,
  19: 931771138485,
  20: 944490527707,
  21: 956603996980,
  22: 968166659804,
  23: 979226436102,
  24: 989825252096,
};

const scaleTemperature = (_pct: BigNumber, _maxTemperature: BigNumber) => {
  if (_maxTemperature.eq(0)) {
    return ZERO_BN;
  }
  const pct = new BigNumber(_pct).div(TEMPERATURE_PRECISION);
  const temperature = pct.times(_maxTemperature).div(TEMPERATURE_PRECISION);
  return temperature.decimalPlaces(6, BigNumber.ROUND_CEIL);
};

const getMorningTemperature = (delta: BigNumber, maxTemperature: BigNumber) => {
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

export default function useTemperature() {
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);
  const season = useAppSelector((s) => s._beanstalk.sun.season);
  const temperature = useAppSelector((s) => s._beanstalk.field.temperature);

  const maxTemperature = temperature.max;
  const sunriseBlock = season.sunriseBlock;
  const morningBlock = morning.blockNumber;
  const isMorning = morning.isMorning;
  const morningIndex = morning.index;

  /// Calculate the temperature of a block during the morning period.
  const calculate = useCallback(
    (_blockNumber: BigNumber = morning.blockNumber) => {
      if (sunriseBlock.lte(0)) return ZERO_BN;
      const delta = _blockNumber.minus(sunriseBlock);
      return getMorningTemperature(delta, maxTemperature);
    },
    [maxTemperature, sunriseBlock, morning.blockNumber]
  );

  /// Generate a mapping of block numbers to their respective temperatures.
  const generate = useCallback(() => {
    const blocks = Array(BLOCKS_PER_MORNING).fill(null);
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

  return [temperatures, { generate, calculate }] as const;
}
