import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { AdvancedPipeStruct, Clipboard } from '@beanstalk/sdk';
import useSdk from '~/hooks/sdk';
import { useAppSelector } from '~/state';
import { ethersBNResult } from '~/util';
import useSeason from '~/hooks/beanstalk/useSeason';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
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
    if (seasonFetchDiff.eq(0) && timeDiff < REFETCH_INTERVAL) {
      return;
    }

    const bs = sdk.contracts.beanstalk;
    const common = {
      target: bs.address,
      clipboard: Clipboard.encode([]),
    };

    const calls: AdvancedPipeStruct[] = [
      {
        ...common,
        callData: bs.interface.encodeFunctionData('getDeltaPodDemand'),
      },
      {
        ...common,
        callData: bs.interface.encodeFunctionData('getLiquidityToSupplyRatio'),
      },
      {
        ...common,
        callData: bs.interface.encodeFunctionData('getPodRate', ['0']),
      },
      {
        ...common,
        callData: bs.interface.encodeFunctionData('getLargestLiqWell'),
      },
    ];

    const results = await bs.callStatic.advancedPipe(calls, '0');
    const deltaPodDemand = ethersBNResult(18)(
      bs.interface.decodeFunctionResult('getDeltaPodDemand', results[0])[0]
    );
    const l2sr = ethersBNResult(18)(
      bs.interface.decodeFunctionResult(
        'getLiquidityToSupplyRatio',
        results[1]
      )[0]
    );
    const podRate = ethersBNResult(18)(
      bs.interface.decodeFunctionResult('getPodRate', results[2])[0]
    );
    const largestLiqWell = bs.interface.decodeFunctionResult(
      'getLargestLiqWell',
      results[3]
    )[0];

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

  return [refetch];
};

const BeanstalkCaseUpdater = () => {
  const [fetch] = useUpdateBeanstalkCaseState();

  useL2OnlyEffect(() => {
    fetch();
  }, [fetch]);

  return null;
};

export default BeanstalkCaseUpdater;
