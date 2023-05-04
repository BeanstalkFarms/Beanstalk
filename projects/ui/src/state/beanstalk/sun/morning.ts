import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import BigNumber from 'bignumber.js';
import {
  setAwaitingMorningBlock,
  setRemainingUntilBlockUpdate,
  updateMorningBlock,
} from './actions';
import {
  selectMorning,
  selectMorningBlockMap,
  selectMorningBlockTime,
} from './reducer';
import { BEAN } from '~/constants/tokens';
import { tokenResult } from '~/util';
import {
  updateTotalSoil,
  updateScaledTemperature,
  updateMaxTemperature,
} from '~/state/beanstalk/field/actions';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useFetchLatestBlock from '~/hooks/chain/useFetchLatestBlock';
import { getDiffNow } from '.';

export const BLOCKS_PER_MORNING = 25;

export const FIRST_MORNING_BLOCK = 1;

export const APPROX_SECS_PER_BLOCK = 12;

export const getIsMorningInterval = (interval: BigNumber) =>
  interval.gte(FIRST_MORNING_BLOCK) && interval.lte(BLOCKS_PER_MORNING);

export function useFetchMorningField() {
  const beanstalk = useBeanstalkContract();
  const dispatch = useDispatch();
  const [fetchLatestBlock] = useFetchLatestBlock();

  const fetch = useCallback(async () => {
    try {
      if (beanstalk) {
        console.debug(
          `[beanstalk/sun/useFetchMorningField] FETCH (contract = ${beanstalk.address})`
        );
        const [adjustedTemperature, maxTemperature, soil, blockData] =
          await Promise.all([
            beanstalk.temperature().then(tokenResult(BEAN)), // FIX ME
            beanstalk.maxTemperature().then(tokenResult(BEAN)), // FIX ME
            beanstalk.totalSoil().then(tokenResult(BEAN)),
            fetchLatestBlock(),
            // beanstalk
          ]);

        console.debug('[beanstalksun/useFetchMorningField] RESULT = ', {
          scaledTemperature: adjustedTemperature.toString(),
          maxTemperature: maxTemperature.toString(),
          soil: soil.toString(),
        });

        dispatch(updateTotalSoil(soil));
        dispatch(updateScaledTemperature(adjustedTemperature));
        dispatch(updateMaxTemperature(maxTemperature));
        dispatch(updateMorningBlock(blockData.blockNumber));

        return [adjustedTemperature, maxTemperature, soil, blockData] as const;
      }
      return [undefined, undefined, undefined, undefined] as const;
    } catch (e) {
      console.debug('[beanstalk/sun/useFetchMorningField] FAILED', e);
      console.error(e);
      return [undefined, undefined, undefined, undefined] as const;
    }
  }, [beanstalk, dispatch, fetchLatestBlock]);

  return [fetch] as const;
}

export default function MorningUpdater() {
  const morningTime = useSelector(selectMorningBlockTime);
  const blockMap = useSelector(selectMorningBlockMap);
  const morning = useSelector(selectMorning);

  const [fetchMorningField] = useFetchMorningField();
  const dispatch = useDispatch();

  /// called when the state is notified that it needs to fetch for updates
  /// If the block from on chain is greater than the block we have stored,
  /// we know we have the most updated state.
  const fetch = useCallback(async () => {
    const [_adjustedTemp, _maxTemp, _soil, blockData] =
      await fetchMorningField();
    console.debug(`[MorningUpdater][fetch], blockData = `, blockData);

    if (blockData?.blockNumber.gt(morning.blockNumber)) {
      dispatch(setAwaitingMorningBlock(false));
    }
  }, [fetchMorningField, morning.blockNumber, dispatch]);

  useEffect(() => {
    if (!morning.isMorning || !Object.keys(blockMap).length) return;

    // set up the timer while in the morning state.
    const intervalId = setInterval(async () => {
      const _remaining = getDiffNow(morningTime.next);
      const remainingSeconds = _remaining.as('seconds');
      // If the lower limit hasn't been reached decrement the remaining time
      if (remainingSeconds > 0) {
        dispatch(setRemainingUntilBlockUpdate(_remaining));
      }
      // if the lower limit is reached, notify the state to
      // fetch for updated block, temperature, & soil values
      else if (remainingSeconds <= 0) {
        dispatch(setAwaitingMorningBlock(true));
        dispatch(setRemainingUntilBlockUpdate(_remaining));
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    morning.isMorning,
    morningTime.next,
    blockMap,
    dispatch,
    morning.blockNumber,
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

  return null;
}
