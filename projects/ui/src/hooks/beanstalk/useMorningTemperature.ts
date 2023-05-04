import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { ONE_BN, TWO_BN } from '~/constants';
import { selectFieldTemperature } from '~/state/beanstalk/field/reducer';
import { selectMorning, selectSunriseBlock } from '~/state/beanstalk/sun';
import { BLOCKS_PER_MORNING } from '~/state/beanstalk/sun/morning';
import { logBN } from '~/util';

// Constants
export const TEMPERATURE_DECIMALS = 6;

export const TEMPERATURE_LOG_BASE = 51;

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
const calculate = (deltaBlocks: BigNumber, maxTemperature: BigNumber) => {
  if (maxTemperature.lte(0) || deltaBlocks.gt(24)) return maxTemperature;
  if (deltaBlocks.eq(0)) return ONE_BN;
  const input = TWO_BN.multipliedBy(deltaBlocks).plus(1);
  const logResult = logBN(TEMPERATURE_LOG_BASE, input);

  return logResult.times(maxTemperature).decimalPlaces(TEMPERATURE_DECIMALS);
};

export default function useMorningTemperature() {
  const morning = useSelector(selectMorning);
  const sunrise = useSelector(selectSunriseBlock);
  const temperatures = useSelector(selectFieldTemperature);

  const maxSeasonTemperature = temperatures.max;
  const sunriseBlock = sunrise.block;

  const temperatureMap = useMemo(() => {
    if (!morning.isMorning) return {};
    const blocks = Array(BLOCKS_PER_MORNING).fill(null);

    return blocks.reduce<MorningTemperatureMap>((prev, _, index) => {
      const delta = new BigNumber(index);
      const interval = delta.plus(1);

      const blockNumber = sunriseBlock.plus(delta);
      const blockKey = blockNumber.toString();

      prev[blockKey] = {
        interval,
        blockNumber,
        temperature: calculate(delta, maxSeasonTemperature),
        maxTemperature: maxSeasonTemperature,
      };

      return prev;
    }, {});
  }, [maxSeasonTemperature, morning.isMorning, sunriseBlock]);

  return temperatureMap;
}
