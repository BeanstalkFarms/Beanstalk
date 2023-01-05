import BigNumber from 'bignumber.js';
import { useSelector } from 'react-redux';
import {
  DELTA_POD_DEMAND_LOWER_BOUND,
  DELTA_POD_DEMAND_UPPER_BOUND,
  MAX_UINT32,
  ONE_BN,
  OPTIMAL_POD_RATE,
  PEG_WEATHER_CASES,
  POD_RATE_LOWER_BOUND,
  POD_RATE_UPPER_BOUND,
  STEADY_SOW_TIME,
  ZERO_BN,
} from '~/constants';
import usePodRate from '~/hooks/beanstalk/usePodRate';
import useSeason from '~/hooks/beanstalk/useSeason';
import { AppState } from '~/state';
import { MaxBN, MinBN } from '~/util';

const RDLower = new BigNumber(POD_RATE_LOWER_BOUND / 100);
const RDOptimal = new BigNumber(OPTIMAL_POD_RATE / 100);
const RDUpper = new BigNumber(POD_RATE_UPPER_BOUND / 100);

/// Section 8.10    Bean Supply
const beanSupply = (
  // The award for successfully calling the sunrise() function for t;
  a_t: BigNumber,
  // The sum of liquidity and time weighted average shortages or excesss of Beans across liquidity pools on the Oracle Whitelist over the previous Season;
  ΔB_t1: BigNumber,
  // The total Unfertilized Sprouts;
  𝒟: BigNumber,
  // The total number of Unharvestable Pods;
  D: BigNumber,
) => {
  const m_t   = MaxBN(a_t, ΔB_t1); 
  const Δ𝒟_t  = MinBN(MaxBN(ZERO_BN, ΔB_t1.div(3)), 𝒟); // The number of Unfertilized Sprouts that are Fertilized by Active Fertilizer and become Rinsable at the beginning of each Season;
  const ΔD_t  = MinBN(MaxBN(ZERO_BN, (ΔB_t1.minus(Δ𝒟_t)).div(2)), D); // The number of Pods that Ripen and become Harvestable at the beginning of each Season
  return [m_t, Δ𝒟_t, ΔD_t];
};

const soilSupply = (
  // newHarvestablePods: The number of Pods that Ripen and become Harvestable at the beginning of each Season;
  ΔD_t: BigNumber,
  // field.weather.yield: The Temperature during t;
  h_t: BigNumber,
  // The Pod Rate at the end of the previous Season;
  RD_t1: BigNumber,
  // bean.deltaB: The sum of liquidity and time weighted average shortages or excesss of Beans across liquidity pools on the Oracle Whitelist over the previous Season;
  ΔB_t1: BigNumber,
) => {
  let x : number;
  if (RDUpper.lte(RD_t1)) {
    x = 0.5;
  } else if (RDLower.lt(RD_t1)) {
    x = 1;
  } else {
    x = 1.5;
  }
  const Smin_t    = (new BigNumber(x).times(ΔD_t)).div(ONE_BN.plus(h_t.div(100)));
  const SStart_t  = MaxBN(ΔB_t1.negated(), Smin_t);
  return SStart_t;
};

// pod rate at end of last season is 2914392367
// ((startSoil - currentSoil) / lastDSoil) * 100 = delta demand 

// See Weather.sol
const MAX_UINT32_BN = new BigNumber(MAX_UINT32);
const getDeltaPodDemand = (
  nextSowTime: BigNumber,
  lastSowTime: BigNumber,
  startSoil: BigNumber,
  endSoil: BigNumber,
  lastDSoil: BigNumber,
) => {
  let deltaPodDemand : BigNumber;
  if (nextSowTime.lt(MAX_UINT32_BN)) {
    if (
      lastSowTime.eq(MAX_UINT32_BN) || // No sows last season
      nextSowTime.lt(300) ||
      (lastSowTime.gt(STEADY_SOW_TIME) &&
        nextSowTime.lt(lastSowTime.minus(STEADY_SOW_TIME)))
    ) {
      deltaPodDemand = MAX_UINT32_BN;
    } else if (
      nextSowTime.lte(lastSowTime.plus(STEADY_SOW_TIME))
    ) {
      deltaPodDemand = ONE_BN;
    } else {
      deltaPodDemand = ZERO_BN;
    }
  } else {
    const dsoil = startSoil.minus(endSoil);
    if (dsoil.eq(0)) deltaPodDemand = ZERO_BN;
    if (lastDSoil.eq(0)) deltaPodDemand = MAX_UINT32_BN;
    else deltaPodDemand = dsoil.div(lastDSoil);
  }
  return deltaPodDemand;
};

const temperature = (
  podRate: BigNumber,
  deltaB: BigNumber,
  deltaPodDemand: BigNumber
) => {
  let caseId: number = 0; 

  // Evlauate Pod rate
  if (podRate.gte(RDUpper)) caseId = 24;
  else if (podRate.gte(RDOptimal)) caseId = 16;
  else if (podRate.gte(RDLower)) caseId = 8;

  // Evaluate price
  if (deltaB.gt(0) ||
      (deltaB.eq(0) && podRate.lte(RDOptimal))) {
    caseId += 4;
  }

  // Evaluate Delta soil demand
  if (deltaPodDemand.gte(DELTA_POD_DEMAND_UPPER_BOUND)) caseId += 2;
  else if (deltaPodDemand.gte(DELTA_POD_DEMAND_LOWER_BOUND)) caseId += 1;

  return [caseId, new BigNumber(PEG_WEATHER_CASES[caseId])] as const;
};

/**
 * 
 */
const usePeg = () => {
  const season    = useSeason();
  const bean      = useSelector<AppState, AppState['_bean']['token']>((state) => state._bean.token);
  const field     = useSelector<AppState, AppState['_beanstalk']['field']>((state) => state._beanstalk.field);
  const barn      = useSelector<AppState, AppState['_beanstalk']['barn']>((state) => state._beanstalk.barn);
  const podRate   = usePodRate();
  
  // END HOTFIX

  const [
    newBeans,
    newRinsableSprouts,
    newHarvestablePods,
  ] = beanSupply(
    ZERO_BN,              // assume a_t = 0
    bean.deltaB,           // current deltaB via beanastalk.totalDeltaB()
    barn.unfertilized,    // current unfertilized sprouts
    field.podLine         // current pod line
  );

  const soilStart = soilSupply(
    newHarvestablePods,   // estimated for next season
    field.weather.yield,  // current temperature
    // POD RATE AS DECIMAL
    // 100% = 1
    podRate.div(100),     // current pod rate (unharvestable pods / bean supply)
    bean.deltaB, // current deltaB via beanstalk.totalDeltaB()
  );

  /// TODO:
  // - Temperature case lookup
  // - Verify soil
  // - Display current deltaDemand?

  /// lastDSoil may be zero -> delta pod demand is infinity
  //    Set delatPodDemand based on nextSowTime
  //    Decimal.from(1e18) = "infinity"
  //    someone sowed faster this season than last season
  //    three cases in which we're increasing
  //      didnt sow all soil
  //      someone sowed soil within first 5 mins
  //      minute-long buffer
  //        deltaPodDemand was increasing, set to infinity
  //        dont know how much demand if it all sells
  //          
  const deltaPodDemand = getDeltaPodDemand(
    field.weather.nextSowTime,
    field.weather.lastSowTime,
    field.weather.startSoil,
    field.soil,
    field.weather.lastDSoil,
  );

  const [caseId, deltaTemperature] = temperature(
    // POD RATE AS DECIMAL
    podRate.div(100),
    bean.deltaB,
    deltaPodDemand,
  );

  // console.log('usePeg', {
  //   inputs: {
  //     deltaB: bean.deltaB.toString(),
  //     podRate: podRate.div(100).toString(),
  //     unfertilized: barn.unfertilized.toString(),
  //     unharvestable: field.podLine.toString(),
  //     weather: {
  //       nextSowTime: field.weather.nextSowTime.toString(),
  //       lastSowTime: field.weather.lastSowTime.toString(),
  //       startSoil: field.weather.startSoil.toString(),
  //       soil: field.soil.toString(),
  //       lastDSoil: field.weather.lastDSoil.toString(),
  //       yield: field.weather.yield.toString(),
  //     }
  //   },
  //   derived: {
  //     deltaBMultiplier: deltaBMultiplier.toString(),
  //     bean.deltaB: bean.deltaB.toString(),
  //   },
  //   outputs: {
  //     newHarvestablePods: newHarvestablePods.toString(),
  //     soilStart: soilStart.toString(),
  //     deltaTemperature: deltaTemperature.toString()
  //   },
  // });

  return {
    rewardBeans: bean.deltaB,
    newRinsableSprouts,
    newHarvestablePods,
    soilStart,
    deltaPodDemand,
    caseId,
    deltaTemperature,
  };
};

export default usePeg;
