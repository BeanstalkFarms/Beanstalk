import BigNumber from 'bignumber.js';
import { ONE_BN, ZERO_BN } from '~/constants';
import { toBNWithDecimals } from "~/util/BigNumber";

/**
 * NOTE: Try not to format this file
 */

const DisplayMaps = {
  quadCase: {
    ExcessivelyHigh: 'Excessively High', // 80% - 100%
    ReasonablyHigh: 'Reasonably High', // 40% - 80%
    ReasonablyLow: 'Reasonably Low', // 12% - 40%
    ExcessivelyLow: 'Excessively Low', // 0% - 12%
  },
  deltaPodDemand: {
    Decreasing: 'Decreasing',
    Steady: 'Steady',
    Increasing: 'Increasing',
  },
  price: {
    PGtQ: 'P > 1.05',
    PGt1: 'P > 1',
    PLt1: 'P < 1',
  },
} as const;

type CaseEvaluationDisplay = keyof typeof DisplayMaps.quadCase;
type DeltaPodDemandDisplay = keyof typeof DisplayMaps.deltaPodDemand;
type BeanPriceStateDisplay = keyof typeof DisplayMaps.price;

type CaseEvaluation = {
  id: number;
  evaluation: string;
}

type CaseData = {
  // mT: Relative Temperature change. (1% = 1e6)
  mT: BigNumber;
  // bT: Absolute Temperature change. (1% = 1)
  bT: BigNumber;
  // mL: Relative Grown Stalk to Liquidity change. (1% = 1e18)
  mL: BigNumber;
  // bL: Absolute Grown Stalk to Liquidity change. (1% = 1e18)
  bL: BigNumber;
};

export type BeanstalkEvaluation = {
  caseId: BigNumber;
  delta: {
    temperature: BigNumber;
    bean2MaxLPGPPerBdv: BigNumber;
    bean2MaxLPGPPerBdvScalar: BigNumber;
  };
  stateDisplay: {
    price: string;
    podRate: string;
    deltaPodDemand: string;
    l2sr: string;
  };
};

export type BeanstalkCaseState = {
  deltaPodDemand: BigNumber;
  l2sr: BigNumber;
  podRate: BigNumber;
  largestLiqWell: string;
  oracleFailure: boolean; 
};

export type CalcDeltaPodDemandProps = {
  soilSoldOut: boolean;
  blocksToSoldOutSoil: BigNumber;
  sownBeans: BigNumber;
}

// Constants

// ---------- POD RATE ----------

const POD_RATE_LOWER_BOUND = 5; // 5%
const POD_RATE_OPTIMAL = 15; // 15%
const POD_RATE_UPPER_BOUND = 25; // 25%

// ---------- BEAN PRICE ----------

const EXCESSIVE_PRICE_THRESHOLD = 1.05;

// ---------- DELTA POD DEMAND ----------

const DELTA_POD_DEMAND_LOWER_BOUND = 0.95; // 95%
const DELTA_POD_DEMAND_UPPER_BOUND = 1.05; // 105%

// ---------- L2SR ----------

// Liquidity to supply ratio bounds
const LP_TO_SUPPLY_RATIO_UPPER_BOUND = 0.8;  // 80%
const LP_TO_SUPPLY_RATIO_OPTIMAL = 0.4;      // 40%
const LP_TO_SUPPLY_RATIO_LOWER_BOUND = 0.12; // 12%

// ---------- MISC ------------

// Max and min are the ranges that the beanToMaxLpGpPerBdvRatioScaled can output.
const MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO = 100e18;
const MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO = 50e18;
const BEAN_MAX_LP_GP_RATIO_RANGE = 
  MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO - 
  MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO;


// TODO: Chain dependent
const SECONDS_PER_BLOCK = 12;

const SECONDS_PER_SEASON = new BigNumber(3600);

/// @dev If all Soil is Sown faster than this, Beanstalk considers demand for Soil to be increasing.
const SOW_TIME_DEMAND_INCR = 600; // seconds

const SOW_TIME_STEADY = 60; // seconds


export class LibCases {

  // ---------- Constants ----------

  // this will eventually become dynamic
  static MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO = 100e18; 

  // this will eventually become dynamic
  static MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO = 50e18;

  static BEAN_MAX_LP_GP_RATIO_RANGE =  
    LibCases.MAX_BEAN_MAX_LP_GP_PER_BDV_RATIO - 
    LibCases.MIN_BEAN_MAX_LP_GP_PER_BDV_RATIO;

  private static T_PLUS_3_L_MINUS_FIFTY = Buffer.from(
    '05F5E1000300056BC75E2D63100000FFFD4A1C50E94E78000000000000000000',
    'hex'
  );

  private static T_PLUS_1_L_MINUS_FIFTY = Buffer.from(
    '05F5E1000100056BC75E2D63100000FFFD4A1C50E94E78000000000000000000',
    'hex'
  );

  private static T_PLUS_0_L_MINUS_FIFTY = Buffer.from(
    '05F5E1000000056BC75E2D63100000FFFD4A1C50E94E78000000000000000000',
    'hex'
  );

  private static T_MINUS_1_L_MINUS_FIFTY = Buffer.from(
    '05F5E100FF00056BC75E2D63100000FFFD4A1C50E94E78000000000000000000',
    'hex'
  );

  private static T_MINUS_3_L_MINUS_FIFTY = Buffer.from(
    '05F5E100FD00056BC75E2D63100000FFFD4A1C50E94E78000000000000000000',
    'hex'
  );

  private static T_PLUS_3_L_PLUS_ONE = Buffer.from(
    '05F5E1000300056BC75E2D6310000000000DE0B6B3A764000000000000000000',
    'hex'
  );

  private static T_PLUS_1_L_PLUS_ONE = Buffer.from(
    '05F5E1000100056BC75E2D6310000000000DE0B6B3A764000000000000000000',
    'hex'
  );

  private static T_PLUS_0_L_PLUS_ONE = Buffer.from(
    '05F5E1000000056BC75E2D6310000000000DE0B6B3A764000000000000000000',
    'hex'
  );

  private static T_PLUS_3_L_PLUS_TWO = Buffer.from(
    '05F5E1000300056BC75E2D6310000000001BC16D674EC8000000000000000000',
    'hex'
  );

  private static T_PLUS_1_L_PLUS_TWO = Buffer.from(
    '05F5E1000100056BC75E2D6310000000001BC16D674EC8000000000000000000',
    'hex'
  );

  private static T_PLUS_0_L_PLUS_TWO = Buffer.from(
    '05F5E1000000056BC75E2D6310000000001BC16D674EC8000000000000000000',
    'hex'
  );

  private static T_PLUS_0_L_MINUS_ONE = Buffer.from(
    '05F5E1000000056BC75E2D63100000FFFFF21F494C589C000000000000000000',
    'hex'
  );

  private static T_MINUS_1_L_MINUS_ONE = Buffer.from(
    '05F5E100FF00056BC75E2D63100000FFFFF21F494C589C000000000000000000',
    'hex'
  );

  private static T_MINUS_3_L_MINUS_ONE = Buffer.from(
    '05F5E100FD00056BC75E2D63100000FFFFF21F494C589C000000000000000000',
    'hex'
  );

  private static casesV2: Buffer[] = [
    //               Dsc soil demand,  Steady soil demand  Inc soil demand
    /// //////////////////// Exremely Low L2SR ///////////////////////
    LibCases.T_PLUS_3_L_MINUS_FIFTY, LibCases.T_PLUS_3_L_MINUS_FIFTY, LibCases.T_PLUS_1_L_MINUS_FIFTY, // Exs Low: P < 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_MINUS_FIFTY, LibCases.T_PLUS_3_L_MINUS_FIFTY, LibCases.T_PLUS_1_L_MINUS_FIFTY, // Rea Low: P < 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_MINUS_FIFTY, LibCases.T_PLUS_1_L_MINUS_FIFTY, LibCases.T_PLUS_0_L_MINUS_FIFTY, // Rea Hgh: P < 1
    LibCases.T_PLUS_0_L_MINUS_FIFTY, LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > 1
    LibCases.T_PLUS_0_L_MINUS_FIFTY, LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_MINUS_FIFTY, LibCases.T_PLUS_1_L_MINUS_FIFTY, LibCases.T_PLUS_0_L_MINUS_FIFTY, // Exs Hgh: P < 1
    LibCases.T_PLUS_0_L_MINUS_FIFTY, LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > 1
    LibCases.T_PLUS_0_L_MINUS_FIFTY, LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    /// //////////////////// Reasonably Low L2SR ///////////////////////
    LibCases.T_PLUS_3_L_MINUS_FIFTY, LibCases.T_PLUS_3_L_MINUS_FIFTY, LibCases.T_PLUS_1_L_MINUS_FIFTY, // Exs Low: P < 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_MINUS_FIFTY, LibCases.T_PLUS_3_L_MINUS_FIFTY, LibCases.T_PLUS_1_L_MINUS_FIFTY, // Rea Low: P < 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_1_L_PLUS_ONE, LibCases.T_PLUS_0_L_PLUS_ONE, // Rea Hgh: P < 1
    LibCases.T_PLUS_0_L_MINUS_ONE, LibCases.T_MINUS_1_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, // P > 1
    LibCases.T_PLUS_0_L_MINUS_FIFTY, LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_1_L_PLUS_ONE, LibCases.T_PLUS_0_L_PLUS_ONE, // Exs Hgh: P < 1
    LibCases.T_PLUS_0_L_MINUS_ONE, LibCases.T_MINUS_1_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, // P > 1
    LibCases.T_PLUS_0_L_MINUS_FIFTY, LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    /// //////////////////// Reasonably High L2SR ///////////////////////
    LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_1_L_PLUS_ONE, // Exs Low: P < 1
    LibCases.T_MINUS_1_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, // P > 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_1_L_PLUS_ONE, // Rea Low: P < 1
    LibCases.T_MINUS_1_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, // P > 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_1_L_PLUS_ONE, LibCases.T_PLUS_0_L_PLUS_ONE, // Rea Hgh: P < 1
    LibCases.T_PLUS_0_L_MINUS_ONE, LibCases.T_MINUS_1_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, // P > 1
    LibCases.T_PLUS_0_L_MINUS_FIFTY, LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_1_L_PLUS_ONE, LibCases.T_PLUS_0_L_PLUS_ONE, // Exs Hgh: P < 1
    LibCases.T_PLUS_0_L_MINUS_ONE, LibCases.T_MINUS_1_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, // P > 1
    LibCases.T_PLUS_0_L_MINUS_FIFTY, LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    /// //////////////////// Extremely High L2SR ///////////////////////
    LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_1_L_PLUS_ONE, // Exs Low: P < 1
    LibCases.T_MINUS_1_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, // P > 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_3_L_PLUS_ONE, LibCases.T_PLUS_1_L_PLUS_ONE, // Rea Low: P < 1
    LibCases.T_MINUS_1_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, // P > 1
    LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_PLUS_TWO, LibCases.T_PLUS_1_L_PLUS_TWO, LibCases.T_PLUS_0_L_PLUS_TWO, // Rea Hgh: P < 1
    LibCases.T_PLUS_0_L_MINUS_ONE, LibCases.T_MINUS_1_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, // P > 1
    LibCases.T_PLUS_0_L_MINUS_FIFTY, LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY, // P > Q
    LibCases.T_PLUS_3_L_PLUS_TWO, LibCases.T_PLUS_1_L_PLUS_TWO, LibCases.T_PLUS_0_L_PLUS_TWO, // Exs Hgh: P < 1
    LibCases.T_PLUS_0_L_MINUS_ONE, LibCases.T_MINUS_1_L_MINUS_ONE, LibCases.T_MINUS_3_L_MINUS_ONE, // P > 1
    LibCases.T_PLUS_0_L_MINUS_FIFTY, LibCases.T_MINUS_1_L_MINUS_FIFTY, LibCases.T_MINUS_3_L_MINUS_FIFTY // P > Q
  ];

  // ---------- Calculations ----------

  static calcDeltaPodDemand(
    data: [
      thisSeason: CalcDeltaPodDemandProps, 
      lastSeason: CalcDeltaPodDemandProps
    ]
  ) {
    if (data.length !== 2) {
      throw new Error(`[LibCases/calcDeltaPodDemand]: expected 2 data points but got ${data.length}`);
    }

    const [ts, ls] = data;

    let deltaPodDemand: BigNumber = ZERO_BN;

    const dSoil = ts.sownBeans;
    const thisSowTime = ts.soilSoldOut 
      ? ts.blocksToSoldOutSoil.times(SECONDS_PER_BLOCK) 
      : SECONDS_PER_SEASON; // 3600 seconds in an hour

    const lastSowTime = ts.soilSoldOut 
      ? ls.blocksToSoldOutSoil.times(SECONDS_PER_BLOCK) 
      : SECONDS_PER_SEASON; // 3600 seconds in an hour
    
    // 
    if (ts.soilSoldOut) {
      if (
        !ls.soilSoldOut || // Didn't sow all last season
        thisSowTime.lt(SOW_TIME_DEMAND_INCR) || // Sow'd all within 10 minutes
        (lastSowTime.gt(SOW_TIME_STEADY) && // Time to sell out soil last season is greater than 1 minute
          thisSowTime.lt(lastSowTime.minus(SOW_TIME_STEADY))) // Sow'd all within 1 minute of last seasons' time to sell out soil
      ) {
        deltaPodDemand = new BigNumber(1e36);
      } else if (
        // Sow'd all within 1 minute of last seasons' time to sell out soil
        thisSowTime.lte(lastSowTime.plus(SOW_TIME_STEADY))
      ) { 
        deltaPodDemand = ONE_BN;
      } else {
        deltaPodDemand = ZERO_BN;
      }
    } else {
      // Soil didn't sell out
      const lastDSoil = ls.sownBeans;

      if (dSoil.eq(0)) {
        deltaPodDemand = ZERO_BN;
      } else if (lastDSoil.eq(0)) {
        deltaPodDemand = new BigNumber(1e36);
      } else {
        deltaPodDemand = dSoil.div(lastDSoil);
      }
      
      return deltaPodDemand;
    }
  }

  // ---------- Evaluation Functions ----------

  static evaluatePodRate(podRate: BigNumber): CaseEvaluation {
    let caseId = 0;
    let ev: CaseEvaluationDisplay = "ExcessivelyLow";
  
    if (podRate.gte(POD_RATE_UPPER_BOUND)) {
      caseId = 27;
      ev = "ExcessivelyHigh";

    } else if (podRate.gte(POD_RATE_OPTIMAL)) {
      caseId = 18;
      ev = "ReasonablyHigh";
    } else if (podRate.gte(POD_RATE_LOWER_BOUND)) {
      caseId = 9;
      ev = "ReasonablyLow";
    }
    
    return {
      id: caseId,
      evaluation: DisplayMaps.quadCase[ev],
    }
  }

  static evaluatePrice(deltaB: BigNumber, largestLiquidityWellBeanPrice: BigNumber): CaseEvaluation {
    let caseId = 0;
    let ev: BeanPriceStateDisplay = "PLt1";
    // p > 1;
    if (deltaB.gt(0)) {
      if (largestLiquidityWellBeanPrice.gt(1)) {
        // P > Q (1.05)
        if (largestLiquidityWellBeanPrice.gt(EXCESSIVE_PRICE_THRESHOLD)) {
          ev = "PGtQ";
          caseId = 5;
        }
      }
      ev = "PGt1"
      caseId = 3;
    }
    // p < 1;
    return {
      id: caseId,
      evaluation: DisplayMaps.price[ev],
    }
  }

  static evaluateDeltaPodDemand(deltaPodDemand: BigNumber): CaseEvaluation {
    let caseId = 0;
    let ev: DeltaPodDemandDisplay = "Steady";
    if (deltaPodDemand.gte(DELTA_POD_DEMAND_UPPER_BOUND)) {
      caseId = 2;
      ev = "Increasing";
    } else if (deltaPodDemand.gte(DELTA_POD_DEMAND_LOWER_BOUND)) {
      caseId = 1;
      ev = "Decreasing";
    }
  
    return {
      id: caseId,
      evaluation: DisplayMaps.deltaPodDemand[ev],
    }
  }

  static evaludateL2SR(l2sr: BigNumber): CaseEvaluation {
    let caseId = 0;
    let ev: CaseEvaluationDisplay = "ExcessivelyLow";
  
    if (l2sr.gte(LP_TO_SUPPLY_RATIO_UPPER_BOUND)) {
      caseId = 108;
      ev = "ExcessivelyHigh";
    } else if (l2sr.gte(LP_TO_SUPPLY_RATIO_OPTIMAL)) {
      caseId = 72;
      ev = "ReasonablyHigh";
    } else if (l2sr.gte(LP_TO_SUPPLY_RATIO_LOWER_BOUND)) {
      caseId = 36;
      ev = "ReasonablyLow";
    }
  
    return {
      id: caseId,
      evaluation: DisplayMaps.quadCase[ev],
    }
  }

  /// ---------- Utils ----------

  private static decodeBytes32Data(buffer: Buffer): CaseData {
    if (buffer.length !== 32) throw new Error('Invalid bytes32 buffer');

    // Extract the values
    const mT = buffer.readUInt32BE(0); // First 4 bytes as unsigned 32-bit integer
    const bT = buffer.readInt8(4); // Next 1 byte as signed 8-bit integer
    const mL = buffer.readBigUInt64BE(5) * BigInt(2 ** 16) + BigInt(buffer.readUInt16BE(13)); // Next 10 bytes as BigInt
    const bL = buffer.readBigInt64BE(15) * BigInt(2 ** 16) + BigInt(buffer.readUInt16BE(23)); // Next 10 bytes as BigInt

    // Convert to BigNumber
    const mTBN = new BigNumber(mT);
    const bTBN = new BigNumber(bT);
    const mLBN = new BigNumber(mL.toString());
    const bLBN = new BigNumber(bL.toString());

    return { mT: mTBN, bT: bTBN, mL: mLBN, bL: bLBN };
  }

  private static getCaseWithCaseId(caseId: BigNumber): Buffer {
    return LibCases.casesV2[caseId.toNumber()];
  } 

  private static getBeanToMaxLPUnit(bL: BigNumber) {
    return bL.times(BEAN_MAX_LP_GP_RATIO_RANGE).div(100e18);
  }

  static evaluateWithCaseId(caseId: BigNumber) {
    const { bT, bL } = LibCases.decodeBytes32Data(
      LibCases.getCaseWithCaseId(caseId)
    );

    const bean2MaxLPGPPerBdvScalar = toBNWithDecimals(bL, 18);
    const bean2MaxLPGPPerBdv = toBNWithDecimals(
      LibCases.getBeanToMaxLPUnit(bL), 
      18
    );

    return {
      bean2MaxLPGPPerBdvScalar,
      bean2MaxLPGPPerBdv,
      deltaTemperature: bT
    }
  }

  static evaluateBeanstalk(
    caseState: BeanstalkCaseState,
    largestLiquidityWellBeanPrice: BigNumber,
    deltaB: BigNumber
  ): BeanstalkEvaluation {
    const podRateEvaluation = LibCases.evaluatePodRate(caseState.podRate);
    const priceEvaluation = LibCases.evaluatePrice(deltaB, largestLiquidityWellBeanPrice);
    const deltaPodDemandEvaluation = LibCases.evaluateDeltaPodDemand(caseState.deltaPodDemand);
    const l2srEvaluation = LibCases.evaludateL2SR(caseState.l2sr);

    const caseId = new BigNumber(podRateEvaluation.id)
      .plus(priceEvaluation.id)
      .plus(deltaPodDemandEvaluation.id)
      .plus(l2srEvaluation.id);

    if (caseId.lt(0) || caseId.gt(144)) {
      throw new Error(`Expected caseId to be within [0,144] , but got ${caseId.toString()}`);
    }

    const {
      deltaTemperature, 
      bean2MaxLPGPPerBdv, 
      bean2MaxLPGPPerBdvScalar
    } = LibCases.evaluateWithCaseId(caseId);

    return {
      caseId,
      delta: {
        temperature: deltaTemperature,
        bean2MaxLPGPPerBdv,
        bean2MaxLPGPPerBdvScalar,
      },
      stateDisplay: {
        price: priceEvaluation.evaluation,
        podRate: podRateEvaluation.evaluation,
        deltaPodDemand: deltaPodDemandEvaluation.evaluation,
        l2sr: l2srEvaluation.evaluation,
      },
    };
  }
}
