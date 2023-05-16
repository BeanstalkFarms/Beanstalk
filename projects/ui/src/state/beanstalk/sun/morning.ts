import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import BigNumber from 'bignumber.js';
import { DateTime } from 'luxon';
import {
  setAwaitingMorningBlock,
  setMorning,
  setRemainingUntilBlockUpdate,
} from './actions';
import { BEAN } from '~/constants/tokens';
import { tokenResult } from '~/util';
import {
  updateMaxTemperature,
  updateScaledTemperature,
  updateTotalSoil,
} from '~/state/beanstalk/field/actions';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { getDiffNow, getMorningResult, getNowRounded } from '.';
import { useAppSelector } from '~/state';
import useTemperature from '~/hooks/beanstalk/useTemperature';

export const BLOCKS_PER_MORNING = 25;

export const FIRST_MORNING_BLOCK = 1;

export const APPROX_SECS_PER_BLOCK = 12;

export const getIsMorningInterval = (interval: BigNumber) =>
  interval.gte(FIRST_MORNING_BLOCK) && interval.lte(BLOCKS_PER_MORNING);

/// sometimes the calculated temperature is 1e(-6) off from the temperature from on chain,
/// so we need to check if the temperature is within a certain range
const isSimilarTo = (value: BigNumber, compare: BigNumber, delta: number) => {
  const lower = compare.minus(delta);
  const upper = compare.plus(delta);
  return lower.lte(value) && upper.gte(value);
};

export function useFetchMorningField() {
  const beanstalk = useBeanstalkContract();
  const dispatch = useDispatch();

  const fetch = useCallback(
    async (options?: { noUpdate: boolean }) => {
      try {
        if (!beanstalk) {
          console.debug(
            '[beanstalk/sun/useFetchMorningField] contract undefined'
          );
          return [undefined, undefined, undefined] as const;
        }

        console.debug(
          `[beanstalk/sun/useFetchMorningField] FETCH (contract = ${beanstalk.address})`
        );

        const [adjustedTemperature, maxTemperature, soil] = await Promise.all([
          beanstalk.temperature().then(tokenResult(BEAN)), // FIX ME
          beanstalk.maxTemperature().then(tokenResult(BEAN)), // FIX ME
          beanstalk.totalSoil().then(tokenResult(BEAN)),
        ]);

        console.debug('[beanstalksun/useFetchMorningField] RESULT = ', {
          scaledTemperature: adjustedTemperature.toNumber(),
          maxTemperature: maxTemperature.toNumber(),
          soil: soil.toNumber(),
        });

        if (!options || !options.noUpdate) {
          console.debug(
            '[beanstalk/sun/useFetchMorningField] Updating store...'
          );
          dispatch(updateScaledTemperature(adjustedTemperature));
          dispatch(updateMaxTemperature(maxTemperature));
          dispatch(updateTotalSoil(soil));
        }

        return [adjustedTemperature, maxTemperature, soil] as const;
      } catch (e) {
        console.debug('[beanstalk/sun/useFetchMorningField] FAILED', e);
        console.error(e);
        return [undefined, undefined, undefined] as const;
      }
    },
    [beanstalk, dispatch]
  );

  return [fetch] as const;
}

export default function MorningUpdater() {
  const morningTime = useAppSelector((s) => s._beanstalk.sun.morningTime);
  const season = useAppSelector((s) => s._beanstalk.sun.season);
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);
  const temperature = useAppSelector((s) => s._beanstalk.field.temperature);
  const [_, { calculate: calculateTemperature }] = useTemperature();

  console.log('[morning/updater]awaiting: ', morningTime.awaiting);

  const sunriseTime = season.timestamp.toSeconds();
  const sunriseBlock = season.sunriseBlock.toString();
  const morningIndex = morning.index;
  const next = morningTime.next;

  const _scaledTemp = temperature.scaled.toString();
  const maxTemp = temperature.max.toString();

  const [fetchMorningField] = useFetchMorningField();

  const dispatch = useDispatch();

  /// called when the state is notified that it needs to fetch for updates
  const fetch = useCallback(async () => {
    const [scaled, max, soil] = await fetchMorningField({ noUpdate: true });
    const calculated = calculateTemperature(morning.blockNumber);

    if (scaled && isSimilarTo(scaled, calculated, 0.1)) {
      console.log('[morning][fetch] setting awaiting to', false);
      dispatch(updateScaledTemperature(scaled));
      dispatch(updateMaxTemperature(max));
      dispatch(updateTotalSoil(soil));
      dispatch(setAwaitingMorningBlock(false));
    }
  }, [fetchMorningField, calculateTemperature, morning.blockNumber, dispatch]);

  useEffect(() => {
    if (!morning.isMorning) return;

    // set up the timer while in the morning state.
    const intervalId = setInterval(async () => {
      const now = getNowRounded();
      const nowAsSeconds = now.toSeconds();
      const _remaining = getDiffNow(morningTime.next, now);
      const remainingSeconds = _remaining.as('seconds');
      console.log('remainingSeconds: ', remainingSeconds);

      if (nowAsSeconds === next.toSeconds() || remainingSeconds <= 0) {
        console.log('[morning][interval] setting awaiting to ', true);
        const morningResult = getMorningResult({
          timestamp: DateTime.fromSeconds(sunriseTime),
          blockNumber: new BigNumber(sunriseBlock),
          options: {
            isAwaiting: true,
          },
        });
        dispatch(setMorning(morningResult));
      } else {
        dispatch(setRemainingUntilBlockUpdate(_remaining));
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    morning.isMorning,
    morningTime.next,
    morning.blockNumber,
    sunriseTime,
    sunriseBlock,
    dispatch,
    next,
  ]);

  /// Fetch & update the field / morning state if we are expecting a new block number
  useEffect(() => {
    if (!morningTime.awaiting || !morning.isMorning) return;
    const intervalId = setInterval(() => {
      fetch();
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [morningTime.awaiting, morning.isMorning, fetch]);

  /// Update the temperature if we have transitioned in/out of the morning state
  useEffect(() => {
    const scaledTemp = new BigNumber(_scaledTemp);

    if (!morning.isMorning) {
      if (!scaledTemp.eq(maxTemp)) {
        console.log(
          '[beanstalk/sun/morning] Not Morning. Refetching morning field'
        );
        fetch();
      }
    }
    if (!morning.isMorning || morningTime.awaiting) return;
    if (morningIndex.eq(0) && scaledTemp.gt(1)) {
      console.log(
        '[beanstalk/sun/morning] New Morning. Refetching morning field'
      );
      fetch();
    }
  }, [
    fetch,
    maxTemp,
    morning.isMorning,
    morningIndex,
    morningTime.awaiting,
    _scaledTemp,
  ]);

  return null;
}
