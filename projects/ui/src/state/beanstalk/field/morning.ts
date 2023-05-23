import { useDispatch } from 'react-redux';
import { useCallback, useEffect } from 'react';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { useAppSelector } from '~/state';

import { useFetchBeanstalkField } from './updater';
import { BEAN } from '~/constants/tokens';
import { tokenResult } from '~/util';
import { getNowRounded, getDiffNow } from '../sun';
import { updateTotalSoil } from './actions';

export function useUpdateMorningField() {
  /// Contract
  const beanstalk = useBeanstalkContract();
  /// App State
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);
  const season = useAppSelector((s) => s._beanstalk.sun.season);
  const soil = useAppSelector((s) => s._beanstalk.field.soil);
  const storedTemperatures = useAppSelector(
    (s) => s._beanstalk.field.temperature
  );
  const morningTimeNext = useAppSelector(
    (s) => s._beanstalk.sun.morningTime.next
  );

  const [fetchBeanstalkField] = useFetchBeanstalkField();

  const dispatch = useDispatch();

  /// Derived
  const morningBlock = morning.blockNumber;
  const sunriseBlock = season.sunriseBlock;

  const deltaBlocks = morningBlock.minus(sunriseBlock);

  const fetchSoil = useCallback(async () => {
    if (!beanstalk) {
      console.log(`[beanstalk/field/morning] fetch: contract undefined`);
      return;
    }
    try {
      const _soil = await beanstalk.totalSoil().then(tokenResult(BEAN));
      console.debug('[beanstalk/field/morning] fetch: soil', _soil.toNumber());
      if (!soil.eq(_soil)) {
        dispatch(updateTotalSoil(_soil));
      }
    } catch (err) {
      console.log('[beanstalk/field/morning] fetch: error', err);
    }
  }, [soil, beanstalk, dispatch]);

  /**
   * If it is morning, then we fetch the soil every 4 seconds
   */
  useEffect(() => {
    if (!morning.isMorning) return;

    const soilUpdateInterval = setInterval(() => {
      const now = getNowRounded();

      const remaining = getDiffNow(morningTimeNext, now).as('seconds');
      if (remaining % 4 === 0) {
        fetchSoil();
      }
    }, 1000);

    return () => {
      clearInterval(soilUpdateInterval);
    };
  }, [fetchSoil, morning.isMorning, morningTimeNext]);
  /**
   * There are certain conditions in which we need to fetch the field
   * If these conditions are met, then we fetch the field every 2 seconds
   *
   * If it is not the morning:
   *    If the max temperature is not equal to the scaled temperature
   *
   * OR
   *
   * If it is the morning:
   *    We are in the 1st interval of the morning & the scaled temperature is not equal to 1.
   *    The temperature of the 1st interval of the morning is always 1%.
   */
  const shouldUpdate = (() => {
    if (!morning.isMorning) {
      return !storedTemperatures.max.eq(storedTemperatures.scaled);
    }
    if (morning.isMorning) {
      return deltaBlocks.isZero() && !storedTemperatures.scaled.eq(1);
    }
    return false;
  })();

  useEffect(() => {
    console.debug('shouldUpdate: ', shouldUpdate);
    if (shouldUpdate) {
      const interval = setInterval(() => {
        fetchBeanstalkField();
      }, 1000);
      return () => {
        clearInterval(interval);
      };
    }
  }, [
    deltaBlocks,
    shouldUpdate,
    morning.isMorning,
    storedTemperatures.max,
    storedTemperatures.scaled,
    fetchBeanstalkField,
  ]);

  // useEffect(() => {
  //   const seasonData = temperatureQuery.data?.seasons;
  //   const first = seasonData?.[0];
  //   if (first?.season && first.season !== season.current.toNumber()) {
  //     temperatureQuery.refetch();
  //   }
  // }, [season, temperatureQuery]);

  return null;
}

export default function MorningFieldUpdater() {
  useUpdateMorningField();

  return null;
}
