import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AdvancedPipeStruct, Clipboard } from '@beanstalk/sdk';
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

      const common = {
        target: beanstalk.address,
        clipboard: Clipboard.encode([]),
      };

      const calls: AdvancedPipeStruct[] = [
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData(
            'harvestableIndex',
            ['0']
          ),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData('podIndex', ['0']),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData('totalSoil'),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData('weather'),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData('temperature'),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData('maxTemperature'),
        },
      ];

      const results = await beanstalk.callStatic.advancedPipe(calls, '0');
      const _harvestableIndex = beanstalk.interface.decodeFunctionResult(
        'harvestableIndex',
        results[0]
      )[0];
      const _podIndex = beanstalk.interface.decodeFunctionResult(
        'podIndex',
        results[1]
      )[0];
      const _soil = beanstalk.interface.decodeFunctionResult(
        'totalSoil',
        results[2]
      )[0];
      const _weather = beanstalk.interface.decodeFunctionResult(
        'weather',
        results[3]
      )[0];
      const _adjustedTemperature = beanstalk.interface.decodeFunctionResult(
        'temperature',
        results[4]
      )[0];
      const _maxTemperature = beanstalk.interface.decodeFunctionResult(
        'maxTemperature',
        results[5]
      )[0];

      const harvestableIndex = tokenResult(BEAN)(_harvestableIndex);
      const podIndex = tokenResult(BEAN)(_podIndex);
      const soil = tokenResult(BEAN)(_soil);
      const weather = {
        lastDSoil: tokenResult(BEAN)(_weather.lastDeltaSoil),
        lastSowTime: bigNumberResult(_weather.lastSowTime),
        thisSowTime: bigNumberResult(_weather.thisSowTime),
      };
      const adjustedTemperature = tokenResult(BEAN)(_adjustedTemperature);
      const maxTemperature = tokenResult(BEAN)(_maxTemperature);

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
