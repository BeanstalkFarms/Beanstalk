import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import useSdk from '~/hooks/sdk';
import { useAppSelector } from '~/state';
import { ethersBNResult } from '~/util';
import useSeason from '~/hooks/beanstalk/useSeason';
import { updateBeanstalkCaseState } from '.';

const REFETCH_INTERVAL = 1000 * 5; // 5 mins

export const useUpdateBeanstalkCaseState = () => {
  const { time } = useAppSelector((s) => s._beanstalk.case);
  const season = useSeason();
  const sdk = useSdk();

  const dispatch = useDispatch();

  const refetch = useCallback(async () => {
    const seasonFetchDiff = season.minus(time.season);
    const timeDiff = Date.now() - time.time;

    if (seasonFetchDiff.eq(0) && timeDiff < REFETCH_INTERVAL) return;

    const bs = sdk.contracts.beanstalk;
    const [deltaPodDemand, l2sr, podRate, largestLiqWell] = await Promise.all([
      bs.getDeltaPodDemand().then(ethersBNResult(18)),
      bs.getLiquidityToSupplyRatio().then(ethersBNResult(18)),
      bs.getPodRate().then(ethersBNResult(18)),
      bs.getLargestLiqWell(),
    ]);

    dispatch(
      updateBeanstalkCaseState({
        caseState: {
          deltaPodDemand,
          l2sr,
          podRate,
          largestLiqWell,
          oracleFailure: false,
        },
        time: {
          time: Date.now(),
          season: season,
        },
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [time, sdk.contracts.beanstalk, season]);

  useEffect(() => {
    if (season.gt(time.season)) return;
    refetch();
  }, [refetch, season, time]);

  return [refetch];
};

const BeanstalkCaseUpdater = () => {
  const [fetch] = useUpdateBeanstalkCaseState();

  useEffect(() => {
    fetch();
  }, [fetch]);

  return null;
};

export default BeanstalkCaseUpdater;
