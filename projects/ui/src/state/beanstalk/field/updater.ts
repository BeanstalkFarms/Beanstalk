import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { bigNumberResult, tokenResult } from '~/util';
import { BEAN } from '~/constants/tokens';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { resetBeanstalkField, updateBeanstalkField } from './actions';
import { ZERO_BN } from '~/constants';

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
      ] = await Promise.all([
        beanstalk.harvestableIndex().then(tokenResult(BEAN)), // FIXME
        beanstalk.podIndex().then(tokenResult(BEAN)),
        beanstalk.totalSoil().then(tokenResult(BEAN)),
        beanstalk.weather().then((_weather) => ({
          didSowBelowMin: _weather.didSowBelowMin,
          didSowFaster: _weather.didSowFaster,
          lastDSoil: tokenResult(BEAN)(_weather.lastDSoil),
          lastSoilPercent: bigNumberResult(_weather.lastSoilPercent),
          lastSowTime: bigNumberResult(_weather.lastSowTime),
          nextSowTime: bigNumberResult(_weather.nextSowTime),
          startSoil: tokenResult(BEAN)(_weather.startSoil),
          yield: bigNumberResult(_weather.yield),
        })),
        // beanstalk.totalHarvested().then(tokenResult(BEAN))
      ] as const);

      console.debug('[beanstalk/field/useBeanstalkField] RESULT');

      dispatch(updateBeanstalkField({
        harvestableIndex,
        podIndex,
        podLine: podIndex.minus(harvestableIndex),
        soil,
        weather,
        rain: {
          // FIXME
          raining: false,
          rainStart: ZERO_BN,
        },
      }));
    }
  }, [
    dispatch,
    beanstalk,
  ]);
  
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
