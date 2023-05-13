import BigNumber from 'bignumber.js';
import { useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ONE_BN, TWO_BN, ZERO_BN } from '~/constants';
import { AppState } from '~/state';
import { BeanstalkField } from '~/state/beanstalk/field';
import { Sun } from '~/state/beanstalk/sun';
import { BLOCKS_PER_MORNING } from '~/state/beanstalk/sun/morning';
import { logBN } from '~/util';

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
 * scaled temperature is calculated as such:
 * t = log51(2 * deltaBlocks + 1) * maxTemperature.
 *
 * Refer to: Beanstalk/protocol/contracts/libraries/LibDibbler.sol
 */
const _calculate = (deltaBlocks: BigNumber, maxTemperature: BigNumber) => {
  if (maxTemperature.lte(0) || deltaBlocks.gt(24)) return maxTemperature;
  if (deltaBlocks.eq(0)) return ONE_BN;
  const input = TWO_BN.multipliedBy(deltaBlocks).plus(1);
  const logResult = logBN(TEMPERATURE_LOG_BASE, input);

  return logResult.times(maxTemperature).decimalPlaces(TEMPERATURE_DECIMALS);
};

export default function useTemperature() {
  const morning = useSelector<AppState, Sun['morning']>(
    (state) => state._beanstalk.sun.morning
  );
  const season = useSelector<AppState, Sun['season']>(
    (state) => state._beanstalk.sun.season
  );
  const temperature = useSelector<AppState, BeanstalkField['temperature']>(
    (state) => state._beanstalk.field.temperature
  );

  const maxTemperature = temperature.max;
  const sunriseBlock = season.sunriseBlock;

  const calculate = useCallback(
    (_blockNumber: BigNumber = morning.blockNumber) => {
      if (sunriseBlock.lte(0)) return ZERO_BN;
      const delta = _blockNumber.minus(sunriseBlock);
      if (delta.lt(0) || delta.gte(25)) return maxTemperature;

      return _calculate(delta, maxTemperature);
    },
    [maxTemperature, sunriseBlock, morning.blockNumber]
  );

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
        temperature: _calculate(delta, maxTemperature),
        maxTemperature: maxTemperature,
      };

      return prev;
    }, {});
  }, [maxTemperature, sunriseBlock]);

  const scaledTemperature = useMemo(() => {
    if (morning.isMorning) {
      const _calculated = calculate();
      const stored = temperature.scaled;
      return BigNumber.max(_calculated, stored);
    }

    return temperature.max;
  }, [calculate, morning.isMorning, temperature]);

  const temperatures = useMemo(
    () => ({
      current: scaledTemperature,
      max: maxTemperature,
    }),
    [scaledTemperature, maxTemperature]
  );

  return [temperatures, { generate, calculate }] as const;
}
