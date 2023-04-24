import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { bigNumberResult, bnResultWithPrecision, tokenResult } from '~/util';
import { BEAN } from '~/constants/tokens';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import {
  resetBeanstalkField,
  updateBeanstalkField,
  updateScaledTemperature,
} from './actions';
import { selectFieldTemperature } from './reducer';
import { TEMPERATURE_PRECISION } from '.';

export const useFetchTemperature = () => {
  const beanstalk = useBeanstalkContract();
  const temperatures = useSelector(selectFieldTemperature);

  const dispatch = useDispatch();

  const fetch = useCallback(async () => {
    const adjustedTemp = await beanstalk
      .temperature()
      .then(bnResultWithPrecision(TEMPERATURE_PRECISION));

    // const maxTemp = await beanstalk.maxTemperature()
    //   .then(bnResultWithPrecision(TEMPERATURE_PRECISION));

    console.debug('[beanstalk/field/useFetchTemperature] RESULT', {
      scaled: adjustedTemp.toString(),
      // max: maxTemp.toString(),
    });
    dispatch(updateScaledTemperature(adjustedTemp));
    return [adjustedTemp] as const;
  }, [beanstalk, dispatch]);

  return [temperatures.scaled, fetch] as const;
};

export const useFetchBeanstalkField = () => {
  const dispatch = useDispatch();
  const beanstalk = useBeanstalkContract();

  // Handlers
  const fetch = useCallback(async () => {
    if (beanstalk) {
      console.debug('[beanstalk/field/useBeanstalkField] FETCH');

      const [
        harvestableIndex,
        podIndex,
        soil,
        weather,
        adjustedTemperature,
        maxTemperature,
      ] = await Promise.all([
        beanstalk.harvestableIndex().then(tokenResult(BEAN)), // FIXME
        beanstalk.podIndex().then(tokenResult(BEAN)),
        beanstalk.totalSoil().then(tokenResult(BEAN)),
        beanstalk.weather().then((_weather) => ({
          lastDSoil: tokenResult(BEAN)(_weather.lastDSoil),
          lastSowTime: bigNumberResult(_weather.lastSowTime),
          thisSowTime: bigNumberResult(_weather.thisSowTime),
        })),
        beanstalk.temperature().then(tokenResult(BEAN)), // FIX ME
        beanstalk.maxTemperature().then(tokenResult(BEAN)), // FIX ME
      ] as const);

      console.debug('[beanstalk/field/useBeanstalkField] RESULT');

      dispatch(
        updateBeanstalkField({
          harvestableIndex,
          podIndex,
          podLine: podIndex.minus(harvestableIndex),
          soil,
          weather,
          temperature: {
            max: maxTemperature,
            scaled: adjustedTemperature,
          },
        })
      );
    }
  }, [dispatch, beanstalk]);

  const clear = useCallback(() => {
    console.debug('[beanstalk/field/useBeanstalkField] CLEAR');
    dispatch(resetBeanstalkField());
  }, [dispatch]);

  return [fetch, clear] as const;
};

// -- Updater

const FieldUpdater = () => {
  const [fetch, clear] = useFetchBeanstalkField();

  useEffect(() => {
    clear();
    fetch();
  }, [clear, fetch]);

  return null;
};

export default FieldUpdater;
