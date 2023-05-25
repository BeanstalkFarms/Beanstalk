import { useDispatch } from 'react-redux';
import { useCallback, useEffect } from 'react';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { useAppSelector } from '~/state';

import { useFetchBeanstalkField } from './updater';
import { BEAN } from '~/constants/tokens';
import { tokenResult } from '~/util';
import { getNowRounded, getDiffNow } from '~/state/beanstalk/sun';
import { updateTotalSoil } from './actions';
import { useSeasonalTemperatureQuery } from '~/generated/graphql';

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
  const temperatureQuery = useSeasonalTemperatureQuery({
    fetchPolicy: 'cache-and-network',
    skip: morning.isMorning,
  });

  /// Contract
  const beanstalk = useBeanstalkContract();

  const dispatch = useDispatch();

  /// Derived
  const morningBlock = morning.blockNumber;
  const sunriseBlock = season.sunriseBlock;
  const deltaBlocks = morningBlock.minus(sunriseBlock);

  /// Temperature Season Data
  const seasonData = temperatureQuery.data?.seasons;
  const currentSeason = season.current;
  const first = seasonData?.[0];

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
      if (remaining % 4 === 0) {
        fetchSoil();
      }
    }, 1000);

    return () => {
      clearInterval(soilUpdateInterval);
    };
  }, [fetchSoil, morning.isMorning, next]);

  /**
   * Refetch the field every 2 seconds for updates if:
   *
   * It is not morning:
   * - If the max temperature is not equal to the scaled temperature
   *
   * OR
   *
   * If it is the morning:
   *    We are in the 1st interval of the morning & the scaled temperature is not equal to 1.
   *    The temperature of the 1st interval of the morning is always 1%.
   */
  const shouldUpdateField = (() => {
    if (!morning.isMorning) {
      return !temperature.max.eq(temperature.scaled);
    }
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
    }, 2000);
    return () => {
      clearInterval(interval);
    };
  }, [fetchBeanstalkField, shouldUpdateField]);

  /// If the user is behind 1 season, update the temperature data
  /// This is to prevent the morning temperature chart & max temperature
  /// chart from being out of sync.
  useEffect(() => {
    /// data not loaded yet
    if (!first || currentSeason.lte(0)) return;

    /// If we are behind 1 season, refetch
    if (currentSeason.minus(first.season).eq(1)) {
      console.debug('refetching temperature data...');
      temperatureQuery.refetch({
        season_lte: currentSeason.toNumber(),
      });
    }
  }, [currentSeason, first, temperatureQuery]);

  return null;
}

export default function MorningFieldUpdater() {
  useUpdateMorningField();

  return null;
}
