import { useDispatch } from 'react-redux';
import { useCallback, useEffect } from 'react';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { useAppSelector } from '~/state';

import { useFetchBeanstalkField } from './updater';
import { BEAN } from '~/constants/tokens';
import { tokenResult } from '~/util';
import { getNowRounded, getDiffNow } from '~/state/beanstalk/sun';
import { updateTotalSoil } from './actions';

const SOIL_UPDATE_INTERVAL = 4;
const FIELD_REFRESH_MS = 2000;

/**
 * useUpdateMorningField's primary function is to ensure that the redux store data
 * reflects the most on-chain data during & right after the morning.
 */

export function useUpdateMorningField() {
  /// App State
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);
  const season = useAppSelector((s) => s._beanstalk.sun.season);
  const soil = useAppSelector((s) => s._beanstalk.field.soil);
  const temperature = useAppSelector((s) => s._beanstalk.field.temperature);
  const next = useAppSelector((s) => s._beanstalk.sun.morningTime.next);

  /// Fetch
  const [fetchBeanstalkField] = useFetchBeanstalkField();

  /// Contract
  const beanstalk = useBeanstalkContract();

  const dispatch = useDispatch();

  /// Derived
  const morningBlock = morning.blockNumber;
  const sunriseBlock = season.sunriseBlock;
  const deltaBlocks = morningBlock.minus(sunriseBlock);

  /// -------------------------------------
  /// Callbacks

  const fetchSoil = useCallback(async () => {
    if (!beanstalk) {
      console.debug(`[beanstalk/field/morning] fetch: contract undefined`);
      return;
    }
    try {
      const _soil = await beanstalk.totalSoil().then(tokenResult(BEAN));
      console.debug('[beanstalk/field/morning] fetch: soil', _soil.toNumber());
      if (!soil.eq(_soil)) {
        dispatch(updateTotalSoil(_soil));
      }
    } catch (err) {
      console.debug('[beanstalk/field/morning] fetch FAILED', err);
    }
  }, [soil, beanstalk, dispatch]);

  /// -------------------------------------
  /// Effects

  // If it is morning, then we fetch the soil every 4 seconds
  useEffect(() => {
    if (!morning.isMorning) return;

    const soilUpdateInterval = setInterval(() => {
      const now = getNowRounded();

      const remaining = getDiffNow(next, now).as('seconds');
      if (remaining % SOIL_UPDATE_INTERVAL === 0) {
        fetchSoil();
      }
    }, 1000);

    return () => {
      clearInterval(soilUpdateInterval);
    };
  }, [fetchSoil, morning.isMorning, next]);

  /**
   * Notes:
   *    We define 'interval' as (currentBlock - sunriseBlock + 1) where 1 <= interval <= 25.
   *
   * Refetch the field every 2 seconds for updates if:
   *
   * If it is the morning:
   *    We are in the 1st interval of the morning & the scaled temperature in redux !== 1.
   *    The temperature of the 1st interval of the morning is always 1%.
   *    - This occurs when we are transitioning into the morning state from the previous season.
   */
  const shouldUpdateField = (() => {
    if (morning.isMorning) {
      return deltaBlocks.isZero() && !temperature.scaled.eq(1);
    }
    return false;
  })();

  useEffect(() => {
    if (!shouldUpdateField) return;

    const interval = setInterval(() => {
      console.debug('[beanstalk/field/morning]: Refetching field');
      fetchBeanstalkField();
    }, FIELD_REFRESH_MS);
    return () => {
      clearInterval(interval);
    };
  }, [fetchBeanstalkField, shouldUpdateField]);

  return null;
}

export default function MorningFieldUpdater() {
  useUpdateMorningField();

  return null;
}
