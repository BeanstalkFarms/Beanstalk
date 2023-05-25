import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import BigNumber from 'bignumber.js';
import { setMorning, setRemainingUntilBlockUpdate } from './actions';
import {
  updateScaledTemperature,
  updateTotalSoil,
} from '~/state/beanstalk/field/actions';
import { getDiffNow, getMorningResult, getNowRounded } from '.';
import { useAppSelector } from '~/state';
import useTemperature from '~/hooks/beanstalk/useTemperature';
import useSoil from '~/hooks/beanstalk/useSoil';

/**
 * Architecture Notes: @Bean-Sama
 *
 * We divide the task of updating the morning into 3 parts:
 *
 * 1. SunUpdater
 * 2. MorningUpdater
 * 3. MorningFieldUpdater
 *
 * ------------------------
 * SunUpdater:
 * - file: ~/state/beanstalk/sun/updater.ts
 * - function: <SunUpdater />
 *
 * When the next season approaches, SunUpdater fetches Beanstalk.time() and updates the redux state
 * with the block number in which gm() was called and the timestamp of that block, refered to as
 * 'sunriseBlock' and 'timestamp' respectively.
 *
 * We rely on Ethereum's consistent block time of 12 seconds to determine the current block number,
 * and the timestamp of that block. If the current timestamp is less than 300 seconds (5 mins = 25 blocks)
 * from the timestamp of the sunriseBlock, then assume that is Morning.
 *
 * Alterntaively, we could fetch for the current block number via RPC-call, however,
 * there can be a delay of up to 6 seconds, which is not ideal for our use case.
 *
 * Refer to getMorningResult() in ~/state/beanstalk/sun/index.ts for more details on this part.
 *
 * ------------------------
 * MorningUpdater:
 * - file: ~/state/beanstalk/sun/morning.ts
 * - function: <MorningUpdater />
 *
 * MorningUpdater is responsible for all things related to the blockNumber and timestamp
 * of the current morning block.
 *
 * Every second during the morning, we update the redux store with the time remaining until the next
 * morning block. Once the next morning block is reached, we update the redux store with the
 * blockNumber and timestamp of the next morning block.
 *
 * MorningUpdater also calculates & updates the scaled temperature based on the next expected block number.
 * In addition, we also update the soil for the next morning block if we are above peg.
 *
 * ------------------------
 *
 * MorningFieldUpdater:
 * - file: ~/state/beanstalk/field/morning.ts
 * - function: <MorningFieldUpdater />
 *
 * We fetch the field at the start & end of the morning to ensure that the maxTemperature & totalSoil
 * are updated. We fetch these values at the start and end of the morning.
 *
 * In addition, we also fetch & update the soil available every 4 seconds during the morning.
 *
 */

export const BLOCKS_PER_MORNING = 25;
export const FIRST_MORNING_BLOCK = 1;
export const APPROX_SECS_PER_BLOCK = 12;

export const getIsMorningInterval = (interval: BigNumber) =>
  interval.gte(FIRST_MORNING_BLOCK) && interval.lte(BLOCKS_PER_MORNING);

function useUpdateMorning() {
  const morningTime = useAppSelector((s) => s._beanstalk.sun.morningTime);
  const season = useAppSelector((s) => s._beanstalk.sun.season);
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);

  const [_, { calculate: calculateTemperature }] = useTemperature();
  const [_soilData, { calculate: calculateNextSoil }] = useSoil();

  const dispatch = useDispatch();

  useEffect(() => {
    if (!morning.isMorning) return;

    // set up the timer while in the  morning state.
    const intervalId = setInterval(async () => {
      const { abovePeg, sunriseBlock, timestamp: sTimestamp } = season;
      const { blockNumber: morningBlock } = morning;

      const now = getNowRounded();
      const _remaining = getDiffNow(morningTime.next, now);
      if (
        now.toSeconds() === morningTime.next.toSeconds() ||
        _remaining.as('seconds') <= 0
      ) {
        const morningResult = getMorningResult({
          timestamp: sTimestamp,
          blockNumber: sunriseBlock,
        });

        const scaledTemp = calculateTemperature(morningBlock.plus(1));
        const nextSoil = abovePeg ? calculateNextSoil(morningBlock) : undefined;

        console.debug('[beanstalk/sun/useUpdateMorning]: new block: ', {
          temp: scaledTemp.toNumber(),
          soil: nextSoil?.toNumber() || 'N/A',
          blockNumber: morningResult.morning.blockNumber.toNumber(),
          index: morningResult.morning.index.toNumber(),
          isMorning: morningResult.morning.isMorning,
        });

        dispatch(updateScaledTemperature(scaledTemp));
        nextSoil && dispatch(updateTotalSoil(nextSoil));
        dispatch(setMorning(morningResult));
      } else {
        dispatch(setRemainingUntilBlockUpdate(_remaining));
      }
    }, 1000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    season,
    morning,
    morningTime.next,
    calculateNextSoil,
    calculateTemperature,
    dispatch,
  ]);

  return null;
}

export default function MorningUpdater() {
  useUpdateMorning();

  return null;
}
