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
} from '~/state/beanstalk/field/actions';
import { SupportedChainId } from '~/constants';
import useSdk from '~/hooks/sdk';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useChainId from '~/hooks/chain/useChainId';
import useFetchLatestBlock from '~/hooks/chain/useFetchLatestBlock';
import { getDiffNow } from '.';

export const BLOCKS_PER_MORNING = 25;

export const FIRST_MORNING_BLOCK = 1;

export const APPROX_SECS_PER_BLOCK = 12;

export const getIsMorningInterval = (interval: BigNumber) =>
  interval.gte(FIRST_MORNING_BLOCK) && interval.lte(BLOCKS_PER_MORNING);

/**
 * DEV ENV ONLY:
 * While in the morning state, Force the block
 * when the remaining timer reaches its lower limit
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

    if (secondsRemaining === 1) {
      console.debug('[useForceBlockMorning]: Forcing block');
      chainUtil.forceBlock();
    }
  }, [chainId, chainUtil, isMorning, remaining, run]);
}

export function useFetchMorningField() {
  const beanstalk = useBeanstalkContract();
  const dispatch = useDispatch();

  const fetch = useCallback(async () => {
    try {
      if (beanstalk) {
        console.debug(
          `[beanstalk/sun/useFetchMorningField] FETCH (contract = ${beanstalk.address})`
        );
        const [adjustedTemperature, maxTemperature, soil] = await Promise.all([
          beanstalk.temperature().then(tokenResult(BEAN)), // FIX ME
          beanstalk.maxTemperature().then(tokenResult(BEAN)), // FIX ME
          beanstalk.totalSoil().then(tokenResult(BEAN)),
        ]);

        console.debug('[beanstalksun/useFetchMorningField] RESULT = ', {
          scaledTemperature: adjustedTemperature.toString(),
          maxTemperature: maxTemperature.toString(),
          soil: soil.toString(),
        });

        dispatch(updateTotalSoil(soil));
        dispatch(updateScaledTemperature(adjustedTemperature));
        dispatch(updateMaxTemperature(maxTemperature));

        return [adjustedTemperature, maxTemperature, soil] as const;
      }
      return [undefined, undefined, undefined] as const;
    } catch (e) {
      console.debug('[beanstalk/sun/useFetchMorningField] FAILED', e);
      console.error(e);
      return [undefined, undefined, undefined] as const;
    }
  }, [beanstalk, dispatch]);

  return [fetch] as const;
}

export default function MorningUpdater() {
  const morningTime = useSelector(selectMorningBlockTime);
  const blockMap = useSelector(selectMorningBlockMap);
  const morning = useSelector(selectMorning);

  const [fetchMorningField] = useFetchMorningField();
  const [fetchLatestBlock] = useFetchLatestBlock();
  const dispatch = useDispatch();

  // useForceBlockMorningDev(true);

  /// called when the state is notified that it needs to fetch for updates
  /// If the block from on chain matches the expected block number,
  /// we know we have the most updated state.
  const fetch = useCallback(async () => {
    const [blockData] = await Promise.all([
      fetchLatestBlock(),
      fetchMorningField(),
    ]);
    console.debug(`[MorningUpdater][fetch], blockData = ${blockData}`);

    if (blockData.blockNumber.eq(morning.blockNumber)) {
      dispatch(setAwaitingMorningBlock(false));
    }
  }, [morning.blockNumber, dispatch, fetchLatestBlock, fetchMorningField]);

  useEffect(() => {
    if (!morning.isMorning || !Object.keys(blockMap).length) return;

    /// set up the timer while in the morning state.
    const intervalId = setInterval(async () => {
      const _remaining = getDiffNow(morningTime.next);
      /// If the lower limit hasn't been reached
      /// decrement the remaining time
      if (_remaining.as('seconds') >= 1) {
        dispatch(setRemainingUntilBlockUpdate(_remaining));
      } else {
        /// if the lower limit is reached, notify the state to
        /// fetch for updated block, temperature, & soil values
        /// refer to useEffect below.
        dispatch(setAwaitingMorningBlock(true));
        dispatch(updateMorningBlock(morning.blockNumber.plus(1)));
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
    fetch,
    morning.blockNumber,
  ]);

  /// Fetch if we are expecting a new block number on-chain
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
