import BigNumber from 'bignumber.js';
import { useMemo } from 'react';
import { useSelector } from 'react-redux';

import { AppState } from '~/state';
import { BeanstalkField } from '~/state/beanstalk/field';
import { selectSunriseBlock } from '~/state/beanstalk/sun';
import { BLOCKS_PER_MORNING } from '~/state/beanstalk/sun/morning';

import { ONE_BN, TWO_BN } from '~/constants';
import { logBN } from '~/util';

// Constants
const TEMPERATURE_DECIMALS = 6;

const LOG_BASE = 51;

//
export type BlockTemperature = {
  interval: BigNumber;
  block: BigNumber;
  temperature: BigNumber;
};

export type MorningTemperatureMap = { [key: number]: BlockTemperature };

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
  const logResult = logBN(LOG_BASE, input);

  return logResult.times(maxTemperature).decimalPlaces(TEMPERATURE_DECIMALS);
};

export default function useMorningTemperature() {
  const beanstalkField = useSelector<AppState, BeanstalkField>(
    (state) => state._beanstalk.field
  );
  const sunrise = useSelector(selectSunriseBlock);

  const maxTemperature = beanstalkField.temperature.max;

  const temperatureMap = useMemo(() => {
    const sunriseTime = sunrise.timestamp;
    const sunriseBlock = sunrise.block;

    if (!sunriseTime || sunriseBlock.lte(0)) return {};

    const blocks = Array(BLOCKS_PER_MORNING).fill(null);
    return blocks.reduce<MorningTemperatureMap>((prev, _, index) => {
      const delta = new BigNumber(index);
      const interval = delta.plus(1);

      return {
        ...prev,
        [interval.toNumber()]: {
          interval,
          block: sunriseBlock.plus(interval),
          temperature: calculate(delta, maxTemperature),
        },
      };
    }, {});
  }, [maxTemperature, sunrise.block, sunrise.timestamp]);

  return {
    temperatureMap,
  };
}
