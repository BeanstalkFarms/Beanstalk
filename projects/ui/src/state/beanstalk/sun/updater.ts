import { DateTime, Duration } from 'luxon';
import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import toast from 'react-hot-toast';
import useSeason from '~/hooks/beanstalk/useSeason';
import { useAppSelector } from '~/state';
import { bigNumberResult } from '~/util/Ledger';
import useSdk, { useRefreshSeeds } from '~/hooks/sdk';
import useChainState from '~/hooks/chain/useChainState';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import { atom, useAtomValue, useSetAtom } from 'jotai';
import { getMorningResult, getNextExpectedSunrise, parseSeasonResult } from '.';
import {
  resetSun,
  setAwaitingSunrise,
  setMorning,
  setNextSunrise,
  updateCurrentSeason,
  updateSeasonResult,
  updateSeasonTime,
} from './actions';

const sunriseRemainingAtom = atom<Duration>(getNextExpectedSunrise().diffNow());

export const useRemainingUntilSunrise = () => {
  const remaining = useAtomValue(sunriseRemainingAtom);
  return remaining;
};

export const useSetRemainingUntilSunrise = () => {
  const setRemaining = useSetAtom(sunriseRemainingAtom);
  return setRemaining;
};

export const useSun = () => {
  const dispatch = useDispatch();
  const sdk = useSdk();
  const beanstalk = sdk.contracts.beanstalk;
  const { isEthereum } = useChainState();

  const fetch = useCallback(async () => {
    try {
      if (beanstalk && !isEthereum) {
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
  }, [beanstalk, isEthereum, dispatch]);

  const clear = useCallback(() => {
    console.debug('[farmer/silo/useSun] clear');
    dispatch(resetSun());
  }, [dispatch]);

  return [fetch, clear] as const;
};

const useUpdateRemainingUntilSunrise = (next: DateTime, awaiting: boolean) => {
  // use atom here instead of updating the redux tree for performance reasons
  const setRemaining = useSetRemainingUntilSunrise();

  const dispatch = useDispatch();

  useEffect(() => {
    if (awaiting === false) {
      const i = setInterval(() => {
        const _remaining = next.diffNow();
        if (_remaining.as('seconds') <= 0) {
          dispatch(setAwaitingSunrise(true));
        } else {
          setRemaining(_remaining);
        }
      }, 1000);
      return () => clearInterval(i);
    }
  }, [awaiting, next, setRemaining, dispatch]);

  return setRemaining;
};

const SunUpdater = () => {
  const [fetch, clear] = useSun();
  const sdk = useSdk();
  const dispatch = useDispatch();
  const season = useSeason();
  const next = useAppSelector((s) => s._beanstalk.sun.sunrise.next);
  const awaiting = useAppSelector((s) => s._beanstalk.sun.sunrise.awaiting);

  const setRemainingUntilSunrise = useSetRemainingUntilSunrise();
  const refreshSeeds = useRefreshSeeds();

  useUpdateRemainingUntilSunrise(next, awaiting);

  useL2OnlyEffect(() => {
    if (!awaiting) return;

    /// When awaiting sunrise, check every 3 seconds to see
    /// if the Season has incremented.
    const i = setInterval(() => {
      (async () => {
        const [newSeason] = await fetch();
        if (newSeason?.current?.gt(season)) {
          const _next = getNextExpectedSunrise();
          dispatch(setAwaitingSunrise(false));
          dispatch(setNextSunrise(_next));
          setRemainingUntilSunrise(_next.diffNow());
          toast.success(
            `The Sun has risen. It is now Season ${newSeason.current.toString()}.`
          );
          await refreshSeeds(sdk);
        }
      })();
    }, 3000);
    return () => clearInterval(i);
  }, [
    sdk,
    next,
    season,
    awaiting,
    fetch,
    dispatch,
    refreshSeeds,
    setRemainingUntilSunrise,
  ]);

  // Fetch when chain changes
  useL2OnlyEffect(() => {
    clear();
    fetch();
  }, [fetch, clear]);

  return null;
};

export default SunUpdater;
