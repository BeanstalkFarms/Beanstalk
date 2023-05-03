import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import BigNumber from 'bignumber.js';

import { selectFieldTemperature, selectMorningTemperatureMap } from './reducer';

import { selectMorning, selectSunriseBlock } from '~/state/beanstalk/sun';
import { BLOCKS_PER_MORNING } from '~/state/beanstalk/sun/morning';

import { ONE_BN, TWO_BN } from '~/constants';
import { logBN } from '~/util';
import { setMorningTemperatureMap, updateTemperatureByBlock } from './actions';
import { MorningTemperatureMap } from '.';

// Constants
export const TEMPERATURE_DECIMALS = 6;

export const TEMPERATURE_LOG_BASE = 51;

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

const initTemperatures = (
  sunriseBlock: BigNumber,
  maxTemperature: BigNumber,
  _existing?: MorningTemperatureMap
): MorningTemperatureMap => {
  const blocks = Array(BLOCKS_PER_MORNING).fill(null);

  const existing = _existing || {};

  return blocks.reduce<MorningTemperatureMap>((prev, _, index) => {
    const delta = new BigNumber(index);
    const interval = delta.plus(1);

    const blockNumber = sunriseBlock.plus(delta);
    const blockKey = blockNumber.toString();

    const base = {
      interval,
      blockNumber,
      temperature: calculate(delta, maxTemperature),
      maxTemperature: maxTemperature,
    };

    if (blockKey in existing) {
      const _intervalInstance = existing[blockKey];
      base.temperature = _intervalInstance.temperature;
      base.maxTemperature = _intervalInstance.maxTemperature;
    }

    return {
      ...prev,
      [blockKey]: { ...base },
    };
  }, {});
};

export function useUpdateMorningTemperatures() {
  const morning = useSelector(selectMorning);
  const sunriseBlock = useSelector(selectSunriseBlock);
  const temperatureMap = useSelector(selectMorningTemperatureMap);
  const temperature = useSelector(selectFieldTemperature);

  const dispatch = useDispatch();

  const temperatureLength = Object.keys(temperatureMap).length;

  const currBlock = temperatureMap[morning.blockNumber.toString()] || undefined;

  const temperaturesMatch =
    currBlock && temperature.scaled.eq(currBlock.temperature);
  const maxTempsMatch =
    currBlock && temperature.max.eq(currBlock.maxTemperature);

  useEffect(() => {
    if (morning.isMorning && currBlock) {
      if (!temperaturesMatch || !maxTempsMatch) {
        dispatch(
          updateTemperatureByBlock({
            ...currBlock,
            temperature: temperature.scaled,
            maxTemperature: temperature.max,
          })
        );
      }
    }
  }, [
    currBlock,
    dispatch,
    morning.isMorning,
    temperature.max,
    temperature.scaled,
    temperaturesMatch,
    maxTempsMatch,
  ]);

  useEffect(() => {
    if (
      morning.isMorning &&
      temperatureLength < BLOCKS_PER_MORNING &&
      sunriseBlock.block.gt(0) &&
      temperature.max.gt(0)
    ) {
      const newTemperatures = initTemperatures(
        sunriseBlock.block,
        temperature.max,
        temperatureMap
      );
      dispatch(setMorningTemperatureMap(newTemperatures));
    } else if (!morning.isMorning && temperatureLength > 0) {
      dispatch(setMorningTemperatureMap({}));
    }
  }, [
    dispatch,
    morning.isMorning,
    sunriseBlock.block,
    temperature.max,
    temperatureLength,
    temperatureMap,
  ]);

  return null;
}
