import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useProvider } from 'wagmi';
import BigNumber from 'bignumber.js';
import { DateTime } from 'luxon';
import { setNextBlockUpdate, updateMorningBlock } from './actions';
import { selectMorning } from './reducer';
import { useFetchTemperature } from '../field/updater';

export const BLOCKS_PER_MORNING = 25;

export const FIRST_MORNING_BLOCK = 1;

const APPROX_SECS_PER_BLOCK = 12;

export const getIsMorningInterval = (block: BigNumber) =>
  block.gte(FIRST_MORNING_BLOCK) && block.lte(BLOCKS_PER_MORNING);

export default function useMorningUpdater() {
  /// Chain
  const provider = useProvider();

  /// Data
  const { isMorning, blockNumber } = useSelector(selectMorning);
  const [_, fetchTemp] = useFetchTemperature();

  /// Helpers
  const dispatch = useDispatch();

  // useForceBlockDevOnly();

  const handleUpdateMorning = useCallback(
    async (_block: number) => {
      const before = DateTime.now();
      const _newBlock = await provider.getBlock('latest');
      fetchTemp();
      const blockTimestamp = DateTime.fromSeconds(_newBlock.timestamp);
      const nextUpdateTime = blockTimestamp.plus({
        seconds: APPROX_SECS_PER_BLOCK,
      });
      dispatch(
        updateMorningBlock({
          blockNumber: new BigNumber(_block),
          timestamp: blockTimestamp,
        })
      );
      setNextBlockUpdate(nextUpdateTime);
      const after = DateTime.now();
      console.debug(
        `[beanstalk/sun/useMorning]: time to fetch block = ${after
          .diff(before)
          .as('milliseconds')}ms`
      );
    },
    [dispatch, fetchTemp, provider]
  );

  useEffect(() => {
    // If it's not morning, remove all listeners
    if (isMorning === false) {
      if (provider.listeners('block').length) {
        provider.removeAllListeners('block');
      }
      return;
    }

    const subscribe = () => {
      provider.on('block', (_blockNumber) => {
        console.debug('[beanstalk/sun][updatedBlockNumber]: ', _blockNumber);
        handleUpdateMorning(_blockNumber);
      });

      return () => {
        provider.removeAllListeners('block');
      };
    };

    const unsubscribe = subscribe();

    return () => {
      unsubscribe();
    };
  }, [handleUpdateMorning, isMorning, provider]);
}

const MAX_MS_DIFF = APPROX_SECS_PER_BLOCK * 1000 * BLOCKS_PER_MORNING * 1.1;

// export function useUpdateMorningBlockRemaining() {
//   const { isMorning, blockNumber, timestamp } = useSelector(selectMorning);
//   const { next, remaining } = useSelector(selectMorningBlockUpdate);
//   const dispatch = useDispatch();

//   console.log('remaining: ', remaining.as('seconds'));

// useEffect(() => {
//   if (!isMorning) return;

//   const intervalId = setInterval(() => {
//     const r = remaining.as('seconds');
//     const updated = remaining.minus({ seconds: 1 });

//     console.log('remaining: ', r);
//     console.log('updated: ', updated.as('seconds'));

//     // dispatch(setNextBlockUpdate(update));
//     dispatch(setRemainingUntilBlockUpdate(remaining.minus({ seconds: 1 })));

//     // const r = remaining.diffNow()
//   }, 1000);

//   return () => {
//     clearInterval(intervalId);
//   };
// }, [isMorning, blockNumber, next, dispatch, timestamp, remaining]);
// return null;
// }
