import { DateTime } from 'luxon';
import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useSeason from '~/hooks/beanstalk/useSeason';
import { AppState } from '~/state';
import { bigNumberResult } from '~/util/Ledger';
import { getMorningResult, getNextExpectedSunrise, parseSeasonResult } from '.';
import {
  resetSun,
  setAwaitingSunrise,
  setMorning,
  setNextSunrise,
  setRemainingUntilSunrise,
  updateCurrentSeason,
  updateSeasonResult,
  updateSeasonTime,
} from './actions';
import useSdk, { useRefreshSeeds } from '~/hooks/sdk';

export const useSun = () => {
  const dispatch = useDispatch();
  const beanstalk = useBeanstalkContract();

  const fetch = useCallback(async () => {
    try {
      if (beanstalk) {
        console.debug(
          `[beanstalk/sun/useSun] FETCH (contract = ${beanstalk.address})`
        );
        const [seasonTime, season, currentSeason] = await Promise.all([
          beanstalk.seasonTime().then(bigNumberResult), /// the season that it could be if sunrise was called
          beanstalk
            .time()
            .then((r) => parseSeasonResult(r))
            .catch((e) => {
              console.error(e);
              return undefined;
            }), /// SeasonStruct
          beanstalk.season().then(bigNumberResult),
        ] as const);

        console.debug(`[beanstalk/sun/useSun] time RESULT: = ${season}`);
        console.debug(
          `[beanstalk/sun/useSun] season = ${currentSeason.toString()}, seasonTime = ${seasonTime}`
        );

        if (season) {
          const morningResult = getMorningResult({
            blockNumber: season.sunriseBlock,
            timestamp: season.timestamp,
          });

          dispatch(updateSeasonResult(season));
          dispatch(setMorning(morningResult));
        } else {
          dispatch(updateCurrentSeason(currentSeason));
        }
        dispatch(updateSeasonTime(seasonTime));

        return [season, seasonTime] as const;
      }
      return [undefined, undefined, undefined] as const;
    } catch (e) {
      console.debug('[beanstalk/sun/useSun] FAILED', e);
      console.error(e);
      return [undefined, undefined, undefined] as const;
    }
  }, [beanstalk, dispatch]);

  const clear = useCallback(() => {
    console.debug('[farmer/silo/useSun] clear');
    dispatch(resetSun());
  }, [dispatch]);

  return [fetch, clear] as const;
};

const SunUpdater = () => {
  const [fetch, clear] = useSun();
  const sdk = useSdk();
  const dispatch = useDispatch();
  const season = useSeason();
  const next = useSelector<AppState, DateTime>(
    (state) => state._beanstalk.sun.sunrise.next
  );
  const awaiting = useSelector<AppState, boolean>(
    (state) => state._beanstalk.sun.sunrise.awaiting
  );

  const refreshSeeds = useRefreshSeeds();

  useEffect(() => {
    if (awaiting === false) {
      /// Setup timer. Count down from now until the start
      /// of the next hour; when the timer is zero, set
      /// `awaiting = true`.
      const i = setInterval(() => {
        const _remaining = next.diffNow();
        if (_remaining.as('seconds') <= 0) {
          // dispatch(setAwaitingSunrise(true));
        } else {
          // dispatch(setRemainingUntilSunrise(_remaining));
        }
      }, 1000);
      return () => clearInterval(i);
    }
    /// When awaiting sunrise, check every 3 seconds to see
    /// if the Season has incremented.
    const i = setInterval(() => {
      (async () => {
        const [newSeason] = await fetch();
        if (newSeason?.current?.gt(season)) {
          const _next = getNextExpectedSunrise();
          dispatch(setAwaitingSunrise(false));
          dispatch(setNextSunrise(_next));
          dispatch(setRemainingUntilSunrise(_next.diffNow()));
          toast.success(
            `The Sun has risen. It is now Season ${newSeason.current.toString()}.`
          );
          await refreshSeeds(sdk);
        }
      })();
    }, 3000);
    return () => clearInterval(i);
  }, [dispatch, awaiting, season, next, fetch, refreshSeeds, sdk]);

  // Fetch when chain changes
  useEffect(() => {
    clear();
    fetch();
  }, [fetch, clear]);

  return null;
};

export default SunUpdater;
