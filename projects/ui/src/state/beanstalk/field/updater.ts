import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { bigNumberResult, tokenResult } from '~/util';
import { BEAN } from '~/constants/tokens';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import useSdk from '~/hooks/sdk';
import { resetBeanstalkField, updateBeanstalkField } from './actions';

export const useFetchBeanstalkField = () => {
  const dispatch = useDispatch();
  const beanstalk = useSdk().contracts.beanstalk;

  // Handlers
  const fetch = useCallback(async () => {
    if (beanstalk) {
      console.debug('[beanstalk/field/useBeanstalkField] FETCH');

      // TODO: multicall?
      const [
        harvestableIndex,
        podIndex,
        soil,
        weather,
        adjustedTemperature,
        maxTemperature,
      ] = await Promise.all([
        beanstalk.harvestableIndex('0').then(tokenResult(BEAN)), // FIXME
        beanstalk.podIndex('0').then(tokenResult(BEAN)),
        beanstalk.totalSoil().then(tokenResult(BEAN)),
        beanstalk.weather().then((_weather) => ({
          lastDSoil: tokenResult(BEAN)(_weather.lastDeltaSoil),
          lastSowTime: bigNumberResult(_weather.lastSowTime),
          thisSowTime: bigNumberResult(_weather.thisSowTime),
        })),
        beanstalk.temperature().then(tokenResult(BEAN)), // FIXME
        beanstalk.maxTemperature().then(tokenResult(BEAN)), // FIXME
      ]);

      console.debug('[beanstalk/field/useBeanstalkField] RESULT', {
        harvestableIndex: harvestableIndex.toString(),
        podIndex: podIndex.toString(),
        soil: soil.toString(),
        weather,
        adjustedTemperature: adjustedTemperature.toString(),
        maxTemperature: maxTemperature.toString(),
      });

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

  useL2OnlyEffect(() => {
    clear();
    fetch();
  }, [clear, fetch]);

  return null;
};

export default FieldUpdater;
