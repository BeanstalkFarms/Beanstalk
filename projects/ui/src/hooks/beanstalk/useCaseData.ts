import { useMemo } from 'react';
import { LibCases } from '~/lib/Beanstalk/LibCases';
import { useAppSelector } from '~/state';

const useBeanstalkCase = () => {
  const caseState = useAppSelector((s) => s._beanstalk.case.caseState);

  const highestLiqWell = caseState.largestLiqWell.toLowerCase();

  const pools = useAppSelector((s) => s._bean.pools);

  const poolState = pools[highestLiqWell];

  const deltaB = useAppSelector((s) => s._bean.token.deltaB);

  const data = useMemo(() => {
    if (!poolState) return;
    const { delta, stateDisplay } = LibCases.evaluateBeanstalk(
      caseState,
      poolState.price,
      deltaB
    );

    console.table({
      // bL: decoded.bL.toString(),
      // bT: decoded.bT.toString(),
      // mL: decoded.mL.toString(),
      // mT: decoded.mT.toString(),
      ...stateDisplay,
      deltaTemperature: delta.temperature?.toString(),
      deltaBean2MaxLPGPPerBdv: delta.bean2MaxLPGPPerBdv?.toString(),
    });

    return 1; // FIX ME
  }, [caseState, deltaB, poolState]);

  return data;
};

export default useBeanstalkCase;
