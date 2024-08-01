import { useAppSelector } from '~/state';
import { useMemo } from 'react';
import { LibCases } from '~/lib/Beanstalk/LibCases';
import { ZERO_BN } from '~/constants';
import useTwaDeltaB from '~/hooks/beanstalk/useTwaDeltaB';

const useBeanstalkCaseData = () => {
  const caseState = useAppSelector((s) => s._beanstalk.case.caseState);
  const pools = useAppSelector((s) => s._bean.pools);

  // TODO: change me to use this value once misc improvements is live
  const { data: deltaBs, isLoading } = useTwaDeltaB();
  // const deltaB = useAppSelector((s) => s._bean.token.deltaB);
  const twaDeltaB = deltaBs?.total || ZERO_BN;

  const highestLiqWell = caseState.largestLiqWell.toLowerCase();
  const poolState = pools[highestLiqWell];

  return useMemo(() => {
    if (!poolState || isLoading) return;

    const { delta, stateDisplay } = LibCases.evaluateBeanstalk(
      caseState,
      poolState.price,
      twaDeltaB
    );
    console.table({
      ...stateDisplay,
      // twaDeltaB: twaDeltaB.toString(),
      // poolPrice: poolState.price?.toString(),
      // deltaTemperature: delta.temperature?.toString(),
      // deltaBean2MaxLPGPPerBdv: delta.bean2MaxLPGPPerBdv?.toString(),
      // deltaBean2MaxLPGPPerBdvScalar: delta.bean2MaxLPGPPerBdvScalar?.toString(),
      podRate: caseState.podRate.toString(),
      deltaPodDemand: caseState.deltaPodDemand.toString(),
    });

    return {
      twaDeltaB: twaDeltaB,
      delta,
      state: caseState,
      stateDisplay,
    };
  }, [caseState, twaDeltaB, poolState, isLoading]);
};

export default useBeanstalkCaseData;
