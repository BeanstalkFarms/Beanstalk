import { DateTime } from 'luxon';
import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useSeason from '~/hooks/beanstalk/useSeason';
import useFetchLatestBlock from '~/hooks/chain/useFetchLatestBlock';
import { AppState } from '~/state';
import { bigNumberResult } from '~/util/Ledger';
import {
  getNextExpectedSunrise,
  initMorningBlockMap,
  parseSeasonResult,
} from '.';
import {
  resetSun,
  setAwaitingSunrise,
  setMorning,
  setNextSunrise,
  setRemainingUntilSunrise,
  updateSeasonResult,
  updateSeasonTime,
} from './actions';

export const useSun = () => {
  const dispatch = useDispatch();
  const beanstalk = useBeanstalkContract();

  const [fetchLatestBlock] = useFetchLatestBlock();

  const fetch = useCallback(async () => {
    try {
      if (beanstalk) {
        console.debug(
          `[beanstalk/sun/useSun] FETCH (contract = ${beanstalk.address})`
        );
        const [seasonTime, season, { blockNumber }] = await Promise.all([
          beanstalk.seasonTime().then(bigNumberResult), /// the season that it could be if sunrise was called
          beanstalk.time().then((r) => parseSeasonResult(r)), /// SeasonStruct
          fetchLatestBlock(),
        ] as const);

        const morningBlockMap = initMorningBlockMap({
          sunriseBlock: season.sunriseBlock,
          timestamp: season.timestamp,
        });

        console.debug(`[beanstalk/sun/useSun] time RESULT: = ${season}`);
        console.debug(
          `[beanstalk/sun/useSun] season = ${season.current}, seasonTime = ${seasonTime}`
        );
        dispatch(updateSeasonResult(season));
        dispatch(updateSeasonTime(seasonTime));
        dispatch(
          setMorning({
            blockMap: morningBlockMap,
            blockNumber,
          })
        );

        return [season, seasonTime, blockNumber] as const;
      }
      return [undefined, undefined, undefined] as const;
    } catch (e) {
      console.debug('[beanstalk/sun/useSun] FAILED', e);
      console.error(e);
      return [undefined, undefined, undefined] as const;
    }
  }, [beanstalk, fetchLatestBlock, dispatch]);

  const clear = useCallback(() => {
    console.debug('[farmer/silo/useSun] clear');
    dispatch(resetSun());
  }, [dispatch]);

  return [fetch, clear] as const;
};

const SunUpdater = () => {
  const [fetch, clear] = useSun();
  const dispatch = useDispatch();
  const season = useSeason();
  const next = useSelector<AppState, DateTime>(
    (state) => state._beanstalk.sun.sunrise.next
  );
  const awaiting = useSelector<AppState, boolean>(
    (state) => state._beanstalk.sun.sunrise.awaiting
  );

  useEffect(() => {
    if (awaiting === false) {
      /// Setup timer. Count down from now until the start
      /// of the next hour; when the timer is zero, set
      /// `awaiting = true`.
      const i = setInterval(() => {
        const _remaining = next.diffNow();
        if (_remaining.as('seconds') <= 0) {
          dispatch(setAwaitingSunrise(true));
        } else {
          dispatch(setRemainingUntilSunrise(_remaining));
        }
      }, 1000);
      return () => clearInterval(i);
    }
    /// When awaiting sunrise, check every 3 seconds to see
    /// if the season has incremented bumped.
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
        }
      })();
    }, 3000);
    return () => clearInterval(i);
  }, [dispatch, awaiting, season, next, fetch]);

  // Fetch when chain changes
  useEffect(() => {
    clear();
    fetch();
  }, [fetch, clear]);

  return null;
};

export default SunUpdater;
