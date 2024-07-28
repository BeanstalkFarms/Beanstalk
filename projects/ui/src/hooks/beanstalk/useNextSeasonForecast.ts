import { useMemo } from 'react';
import {
  ONE_BN,
  OPTIMAL_POD_RATE,
  POD_RATE_LOWER_BOUND,
  POD_RATE_UPPER_BOUND,
  ZERO_BN,
} from '~/constants';
import { LibCases } from '~/lib/Beanstalk/LibCases';
import { useAppSelector } from '~/state';
import { MaxBN } from '~/util';
import BigNumber from 'bignumber.js';
import usePrice from './usePrice';

const RDLower = new BigNumber(POD_RATE_LOWER_BOUND / 100);
const RDOptimal = new BigNumber(OPTIMAL_POD_RATE / 100);
const RDUpper = new BigNumber(POD_RATE_UPPER_BOUND / 100);

const soilSupply = (
  // newHarvestablePods: The number of Pods that Ripen and become Harvestable at the beginning of each Season;
  ΔD_t: BigNumber,
  // field.weather.yield: The Temperature during t;
  h_t: BigNumber,
  // The Pod Rate at the end of the previous Season;
  RD_t1: BigNumber,
  // bean.deltaB: The sum of liquidity and time weighted average shortages or excesss of Beans across liquidity pools on the Minting Whitelist over the previous Season;
  ΔB_t1: BigNumber
) => {
  let x: number;
  if (RDUpper.lte(RD_t1)) {
    x = 0.5;
  } else if (RDLower.lt(RD_t1)) {
    x = 1;
  } else {
    x = 1.5;
  }
  const Smin_t = new BigNumber(x).times(ΔD_t).div(ONE_BN.plus(h_t.div(100)));
  const SStart_t = MaxBN(ΔB_t1.negated(), Smin_t);
  return SStart_t;
};

const useNextSeasonForecast = () => {
  const caseState = useAppSelector((s) => s._beanstalk.case.caseState);
  const pools = useAppSelector((s) => s._bean.pools);
  const deltaB = useAppSelector((s) => s._bean.token.deltaB);
  const maxFieldTemperature = useAppSelector(
    (s) => s._beanstalk.field.temperature.max
  );
  const season = useAppSelector((s) => s._beanstalk.sun.season.current);
  const price = usePrice();

  const highestLiqWell = caseState.largestLiqWell.toLowerCase();
  const poolState = pools[highestLiqWell];

  

  const caseData = useMemo(() => {
    console.log("curTemp: ", maxFieldTemperature.toString());
    if (!poolState) return;
    const { delta, stateDisplay } = LibCases.evaluateBeanstalk(
      caseState,
      poolState.price,
      deltaB
    );

    console.table({
      ...stateDisplay,
      currTemp: maxFieldTemperature.toString(),
      deltaTemperature: delta.temperature?.toString(),
      deltaBean2MaxLPGPPerBdv: delta.bean2MaxLPGPPerBdv?.toString(),
    });

    const nextSeason = season.plus(1);
    const rewardBeans = ZERO_BN;
    const maxSoil = ZERO_BN;
    const beanMaxLPScalar = ZERO_BN;

    const forecast = {
      season: nextSeason,
      newBeansMinted: rewardBeans,
      maxSoil: maxSoil,
      maxTemperature: {
        value: maxFieldTemperature.plus(delta.temperature),
        display: delta.temperature.gt(0) ? 'Expected Change' : undefined,
      },
      beanMaxLPScalar: {
        value: beanMaxLPScalar,
        display: undefined,
      },
      price: {
        value: price,
        display: stateDisplay.price,
      },
      l2sr: {
        value: caseState.l2sr,
        display: stateDisplay.l2sr,
      },
      podRate: {
        value: caseState.podRate,
        display: stateDisplay.podRate,
      },
      deltaDemand: {
        value: caseState.deltaPodDemand,
        display: stateDisplay.deltaPodDemand,
      },
    };

    return forecast;
  }, [caseState, deltaB, maxFieldTemperature, poolState, price, season]);

  return caseData;
};

export default useNextSeasonForecast;
