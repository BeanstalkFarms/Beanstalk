import { useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { TestUtils } from '@beanstalk/sdk';
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
import { IS_DEV, tokenResult } from '~/util';
import {
  updateTotalSoil,
  updateScaledTemperature,
  updateMaxTemperature,
  updateTemperatureByBlock,
  setMorningTemperatureMap,
} from '~/state/beanstalk/field/actions';
import { SupportedChainId } from '~/constants';
import useSdk from '~/hooks/sdk';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useChainId from '~/hooks/chain/useChainId';
import useFetchLatestBlock from '~/hooks/chain/useFetchLatestBlock';
import { getDiffNow, selectSunriseBlock } from '.';

export const BLOCKS_PER_MORNING = 25;

export const FIRST_MORNING_BLOCK = 1;

export const APPROX_SECS_PER_BLOCK = 12;

export const getIsMorningInterval = (interval: BigNumber) =>
  interval.gte(FIRST_MORNING_BLOCK) && interval.lte(BLOCKS_PER_MORNING);

/**
 * NOTES: DEV ENV ONLY!!!
 *
 * While in the morning state, Force the block when the remaining timer reaches its lower limit.
 * Turning this off will cause the morning state to be stuck until the next block is mined & fetch infinitely.
 */
// eslint-disable-next-line unused-imports/no-unused-vars
function useForceBlockMorningDev(run: boolean = false) {
  const sdk = useSdk();
  const chainUtil = useMemo(() => new TestUtils.BlockchainUtils(sdk), [sdk]);

  const chainId = useChainId();
  const { remaining } = useSelector(selectMorningBlockTime);
  const { isMorning } = useSelector(selectMorning);

  useEffect(() => {
    if (chainId !== SupportedChainId.LOCALHOST || !IS_DEV) return;
    if (!isMorning || !run) return;

    const secondsRemaining = Math.floor(remaining.as('seconds'));

    if (secondsRemaining === 0) {
      console.debug('[useForceBlockMorning]: Forcing block');
      chainUtil.forceBlock();
    }
  }, [chainId, chainUtil, isMorning, remaining, run]);
}

export function useFetchMorningField() {
  const beanstalk = useBeanstalkContract();
  const dispatch = useDispatch();
  const [fetchLatestBlock] = useFetchLatestBlock();
  const sunriseBlock = useSelector(selectSunriseBlock);

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
        const interval = blockData.blockNumber
          .minus(sunriseBlock.block)
          .plus(1);
        console.debug(
          '[beanstalk/sun/useFetchMorningField] interval = ',
          interval.toString()
        );
        if (interval.lte(25)) {
          dispatch(
            updateTemperatureByBlock({
              interval,
              blockNumber: blockData.blockNumber,
              temperature: adjustedTemperature,
              maxTemperature,
            })
          );
        } else {
          dispatch(setMorningTemperatureMap({}));
        }

        return [adjustedTemperature, maxTemperature, soil, blockData] as const;
      }
      return [undefined, undefined, undefined, undefined] as const;
    } catch (e) {
      console.debug('[beanstalk/sun/useFetchMorningField] FAILED', e);
      console.error(e);
      return [undefined, undefined, undefined, undefined] as const;
    }
  }, [beanstalk, dispatch, fetchLatestBlock, sunriseBlock.block]);

  return [fetch] as const;
}

export default function MorningUpdater() {
  const morningTime = useSelector(selectMorningBlockTime);
  const blockMap = useSelector(selectMorningBlockMap);
  const morning = useSelector(selectMorning);

  const [fetchMorningField] = useFetchMorningField();
  const dispatch = useDispatch();

  useForceBlockMorningDev(true);

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
    }, 500);

    return () => {
      clearInterval(intervalId);
    };
  }, [morningTime.awaiting, morning.isMorning, fetch]);

  return null;
}
