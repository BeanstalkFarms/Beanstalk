import { useAppSelector } from '~/state';
import { useMemo } from 'react';
import { LibCases } from '~/lib/Beanstalk/LibCases';

const useBeanstalkCaseData = () => {
  const caseState = useAppSelector((s) => s._beanstalk.case.caseState);
  const pools = useAppSelector((s) => s._bean.pools);
  const deltaB = useAppSelector((s) => s._bean.token.deltaB);

  const highestLiqWell = caseState.largestLiqWell.toLowerCase();
  const poolState = pools[highestLiqWell];

  return useMemo(() => {
    if (!poolState) return;

    const { delta, stateDisplay } = LibCases.evaluateBeanstalk(
      caseState,
      poolState.price,
      deltaB
    );

    // console.table({
    //   ...stateDisplay,
    //   deltaTemperature: delta.temperature?.toString(),
    //   deltaBean2MaxLPGPPerBdv: delta.bean2MaxLPGPPerBdv?.toString(),
    // });

    return {
      delta,
      state: caseState,
      stateDisplay,
    };
  }, [caseState, deltaB, poolState]);
};

export default useBeanstalkCaseData;
