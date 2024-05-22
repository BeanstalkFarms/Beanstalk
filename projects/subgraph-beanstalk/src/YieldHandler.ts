import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Beanstalk } from "../generated/Season-Replanted/Beanstalk";
import { BEANSTALK, BEAN_ERC20, FERTILIZER } from "../../subgraph-core/utils/Constants";
import { BI_10, ONE_BD, ONE_BI, toBigInt, toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadFertilizer } from "./utils/Fertilizer";
import { loadFertilizerYield } from "./utils/FertilizerYield";
import {
  loadSilo,
  loadSiloAsset,
  loadSiloHourlySnapshot,
  loadSiloYield,
  loadTokenYield,
  loadWhitelistTokenSetting,
  SiloAsset_findIndex_token
} from "./utils/SiloEntities";
import { BigDecimal_max, BigDecimal_sum, BigInt_max, BigInt_sum } from "../../subgraph-core/utils/ArrayMath";
import { getGerminatingBdvs, tryLoadBothGerminating } from "./utils/Germinating";
import { getCurrentSeason } from "./utils/Season";
import { SiloAsset, WhitelistTokenSetting } from "../generated/schema";

const ROLLING_24_WINDOW = 24;
const ROLLING_7_DAY_WINDOW = 168;
const ROLLING_30_DAY_WINDOW = 720;

// Note: minimum value of `t` is 6075
export function updateBeanEMA(t: i32, timestamp: BigInt): void {
  updateWindowEMA(t, timestamp, ROLLING_24_WINDOW);
  updateWindowEMA(t, timestamp, ROLLING_7_DAY_WINDOW);
  updateWindowEMA(t, timestamp, ROLLING_30_DAY_WINDOW);
}

/**
 *
 *
 */
function updateWindowEMA(t: i32, timestamp: BigInt, window: i32): void {
  // Historic cache values up to season 20,000
  if (t <= 20_000) {
    let silo = loadSilo(BEANSTALK);
    let siloYield = loadSiloYield(t, window);

    siloYield.whitelistedTokens = silo.whitelistedTokens;
    siloYield.save();

    updateFertAPY(t, timestamp, window);

    return;
  }

  let silo = loadSilo(BEANSTALK);
  let siloYield = loadSiloYield(t, window);

  // When less then window data points are available,
  // smooth over whatever is available. Otherwise use the full window.
  siloYield.u = t - 6074 < window ? t - 6074 : window;
  siloYield.whitelistedTokens = silo.whitelistedTokens;

  // Calculate the current beta value
  siloYield.beta = BigDecimal.fromString("2").div(BigDecimal.fromString((siloYield.u + 1).toString()));

  // Perform the EMA Calculation
  let currentEMA = ZERO_BD;
  let priorEMA = ZERO_BD;

  if (siloYield.u < window) {
    // Recalculate EMA from initial season since beta has changed
    for (let i = 6075; i <= t; i++) {
      let season = loadSiloHourlySnapshot(BEANSTALK, i, timestamp);
      currentEMA = toDecimal(season.deltaBeanMints).minus(priorEMA).times(siloYield.beta).plus(priorEMA);
      priorEMA = currentEMA;
    }
  } else {
    // Calculate EMA for the prior 720 seasons
    for (let i = t - window + 1; i <= t; i++) {
      let season = loadSiloHourlySnapshot(BEANSTALK, i, timestamp);
      currentEMA = toDecimal(season.deltaBeanMints).minus(priorEMA).times(siloYield.beta).plus(priorEMA);
      priorEMA = currentEMA;
    }
  }

  siloYield.beansPerSeasonEMA = currentEMA;
  siloYield.createdAt = timestamp;
  siloYield.save();

  updateSiloVAPYs(t, timestamp, window);
  updateFertAPY(t, timestamp, window);
}

export function updateSiloVAPYs(t: i32, timestamp: BigInt, window: i32): void {
  let silo = loadSilo(BEANSTALK);
  let siloYield = loadSiloYield(t, window);
  const currentEMA = siloYield.beansPerSeasonEMA;

  // Retrieve all current whitelist settings, and determine whether gauge is live or not.
  // Indices in whitelistSettings, gaugeSettings, and apys arrays refer to the same token.
  let whitelistSettings: WhitelistTokenSetting[] = [];
  let gaugeSettings: Array<WhitelistTokenSetting | null> = [];
  let isGaugeLive = false;
  for (let i = 0; i < siloYield.whitelistedTokens.length; ++i) {
    let token = Address.fromString(siloYield.whitelistedTokens[i]);
    let tokenSetting = loadWhitelistTokenSetting(token);

    whitelistSettings.push(tokenSetting);
    if (tokenSetting.gpSelector !== null) {
      gaugeSettings.push(tokenSetting);
      isGaugeLive = true;
    } else {
      gaugeSettings.push(null);
    }
  }

  let apys: BigDecimal[][] = [];

  // Chooses which apy calculation to use
  if (!isGaugeLive) {
    const beanGrownStalk = loadWhitelistTokenSetting(BEAN_ERC20).stalkEarnedPerSeason;
    for (let i = 0; i < whitelistSettings.length; ++i) {
      const tokenAPY = calculateAPYPreGauge(
        currentEMA,
        toDecimal(whitelistSettings[i].stalkEarnedPerSeason),
        toDecimal(beanGrownStalk),
        silo.stalk.plus(silo.plantableStalk),
        silo.seeds
      );
      apys.push(tokenAPY);
    }
  } else {
    let tokens: i32[] = [];
    let gaugeLpPoints: BigDecimal[] = [];
    let gaugeLpDepositedBdv: BigDecimal[] = [];
    let gaugeLpOptimalPercentBdv: BigDecimal[] = [];

    let nonGaugeDepositedBdv = ZERO_BD;
    let depositedBeanBdv = ZERO_BD;

    let initialR = toDecimal(silo.beanToMaxLpGpPerBdvRatio!, 20);
    // Stalk has 10 decimals
    let siloStalk = toDecimal(silo.stalk.plus(silo.plantableStalk), 10);

    let germinatingBeanBdv: BigDecimal[] = [];
    let germinatingGaugeLpBdv: BigDecimal[][] = [];
    let germinatingNonGaugeBdv: BigDecimal[] = [ZERO_BD, ZERO_BD];

    let staticSeeds: Array<BigDecimal | null> = [];

    // All tokens that are/could have been deposited in the silo
    const siloTokens = siloYield.whitelistedTokens.concat(silo.dewhitelistedTokens);
    const depositedAssets: SiloAsset[] = [];
    for (let i = 0; i < siloTokens.length; ++i) {
      depositedAssets.push(loadSiloAsset(BEANSTALK, Address.fromString(siloTokens[i])));
    }

    // .load() is not supported on graph-node v0.30.0. Instead the above derivation of depositedAssets is used
    // const depositedAssets = silo.assets.load();

    for (let i = 0; i < whitelistSettings.length; ++i) {
      // Get the total deposited bdv of this asset. Remove whitelsited assets from the list as they are encountered
      const depositedIndex = SiloAsset_findIndex_token(depositedAssets, whitelistSettings[i].id.toHexString());
      const depositedAsset = depositedAssets.splice(depositedIndex, 1)[0];
      const depositedBdv = toDecimal(depositedAsset.depositedBDV);

      const germinating = getGerminatingBdvs(Address.fromBytes(whitelistSettings[i].id));

      if (gaugeSettings[i] !== null) {
        tokens.push(gaugeLpPoints.length);
        gaugeLpPoints.push(toDecimal(gaugeSettings[i]!.gaugePoints!, 18));
        gaugeLpOptimalPercentBdv.push(toDecimal(gaugeSettings[i]!.optimalPercentDepositedBdv!));
        gaugeLpDepositedBdv.push(depositedBdv);
        germinatingGaugeLpBdv.push(germinating);
        staticSeeds.push(null);
      } else {
        if (whitelistSettings[i].id == BEAN_ERC20) {
          tokens.push(-1);
          depositedBeanBdv = depositedBdv;
          germinatingBeanBdv = germinating;
          staticSeeds.push(null);
        } else {
          tokens.push(-2);
          nonGaugeDepositedBdv = nonGaugeDepositedBdv.plus(depositedBdv);
          germinatingNonGaugeBdv = [germinatingNonGaugeBdv[0].plus(germinating[0]), germinatingNonGaugeBdv[1].plus(germinating[1])];
          staticSeeds.push(toDecimal(whitelistSettings[i].stalkEarnedPerSeason));
        }
      }
    }

    // Remaining assets in the depositedAssets list must have been dewhitelisted. Include in nonGaugeBdv.
    for (let i = 0; i < depositedAssets.length; ++i) {
      nonGaugeDepositedBdv = nonGaugeDepositedBdv.plus(toDecimal(depositedAssets[i].depositedBDV));
    }

    const CATCH_UP_RATE = BigDecimal.fromString("4320");
    apys = calculateGaugeVAPYs(
      tokens,
      currentEMA,
      gaugeLpPoints,
      gaugeLpDepositedBdv,
      nonGaugeDepositedBdv,
      gaugeLpOptimalPercentBdv,
      initialR,
      depositedBeanBdv,
      siloStalk,
      CATCH_UP_RATE,
      BigInt.fromU32(getCurrentSeason(BEANSTALK)),
      germinatingBeanBdv,
      germinatingGaugeLpBdv,
      germinatingNonGaugeBdv,
      staticSeeds
    );
  }

  // Save the apys
  for (let i = 0; i < apys.length; ++i) {
    let tokenYield = loadTokenYield(Address.fromBytes(whitelistSettings[i].id), t, window);
    tokenYield.beanAPY = apys[i][0];
    tokenYield.stalkAPY = apys[i][1];
    tokenYield.createdAt = timestamp;
    tokenYield.save();
  }
}

/**
 *
 * @param n An estimate of number of Beans minted to the Silo per Season on average
 * over the next 720 Seasons. This could be pre-calculated as a SMA, EMA, or otherwise.
 * @param seedsPerBDV The number of seeds per BDV Beanstalk rewards for this token.
 * @returns
 */

export function calculateAPYPreGauge(
  n: BigDecimal,
  seedsPerBDV: BigDecimal,
  seedsPerBeanBDV: BigDecimal,
  stalk: BigInt,
  seeds: BigInt
): BigDecimal[] {
  // Initialize sequence
  let C = toDecimal(seeds); // Init: Total Seeds
  let K = toDecimal(stalk, 10); // Init: Total Stalk
  let b = seedsPerBDV.div(seedsPerBeanBDV); // Init: User BDV
  let k = BigDecimal.fromString("1"); // Init: User Stalk

  // Farmer initial values
  let b_start = b;
  let k_start = k;

  // Placeholders for above values during each iteration
  let C_i = ZERO_BD;
  let K_i = ZERO_BD;
  let b_i = ZERO_BD;
  let k_i = ZERO_BD;

  // Stalk and Seeds per Deposited Bean.
  let STALK_PER_SEED = BigDecimal.fromString("0.0001"); // 1/10,000 Stalk per Seed
  let STALK_PER_BEAN = seedsPerBeanBDV.div(BigDecimal.fromString("10000")); // 3 Seeds per Bean * 1/10,000 Stalk per Seed

  for (let i = 0; i < 8760; i++) {
    // Each Season, Farmer's ownership = `current Stalk / total Stalk`
    let ownership = k.div(K);
    let newBDV = n.times(ownership);

    // Total Seeds: each seignorage Bean => 3 Seeds
    C_i = C.plus(n.times(seedsPerBeanBDV));
    // Total Stalk: each seignorage Bean => 1 Stalk, each outstanding Bean => 1/10_000 Stalk
    K_i = K.plus(n).plus(STALK_PER_SEED.times(C));
    // Farmer BDV: each seignorage Bean => 1 BDV
    b_i = b.plus(newBDV);
    // Farmer Stalk: each 1 BDV => 1 Stalk, each outstanding Bean => d = 1/5_000 Stalk per Bean
    k_i = k.plus(newBDV).plus(STALK_PER_BEAN.times(b));

    C = C_i;
    K = K_i;
    b = b_i;
    k = k_i;
  }

  // Examples:
  // -------------------------------
  // b_start = 1
  // b       = 1
  // b.minus(b_start) = 0   = 0% APY
  //
  // b_start = 1
  // b       = 1.1
  // b.minus(b_start) = 0.1 = 10% APY
  let beanApy = b.minus(b_start); // beanAPY
  let stalkApy = k.minus(k_start); // stalkAPY

  return [beanApy, stalkApy];
}

/**
 * Calculates silo Bean/Stalk vAPY when Seed Gauge is active.
 *
 * Each provided BigDecimal value should already be converted such that it has 0 decimals.
 * All of the array parameters should not be empty and be the same length, with one entry for every gauge lp deposit type
 *
 * @param token Which tokens to calculate the apy for. For a gauge lp token, provide an index corresponding to
 *        the position of that lp in the other array parameters. For Bean, provide -1.
 *        for a non-gauge token, provide -2. See staticSeeds parameter below
 * @param earnedBeans The average number of beans earned per season to use in the simulation
 * @param gaugeLpPoints Array of gauge points assigned to each gauge lp. With a single lp, there will be one entry
 * @param gaugeLpDepositedBdv Array of deposited bdv corresponding to each gauge lp
 * @param nonGaugeDepositedBdv Amount of (whitelisted) deposited bdv that is not tracked by the gauge system
 * @param gaugeLpOptimalPercentBdv Array of optimal bdv percentages for each lp
 * @param initialR Initial ratio of max LP gauge points per bdv to Bean gauge points per bdv
 * @param siloDepositedBeanBdv The total number of Beans in the silo
 * @param siloStalk The total amount of stalk in the silo
 * @param catchUpRate Target number of hours for a deposit's grown stalk to catch up
 *
 * GERMINATING PARAMS - First index corresponds to Even germinating, second index is Odd.
 *
 * @param season The current season, required for germinating.
 * @param germinatingBeanBdv Germinating beans bdv
 * @param gaugeLpGerminatingBdv Germinating bdv of each gauge lp. Each outer array entry corresponds to one lp
 * @param nonGaugeGerminatingBdv Germinating bdv of all non-gauge whitelisted assets
 *
 * UNRIPE
 *
 * @param staticSeeds Provided when `token` does not have its seeds dynamically changed by gauge
 *
 * Future work includes improvement of the `r` value simulation. This involves using Beanstalk's current state,
 * including L2SR and debt level (temperature cases). Also can be improved by tracking an expected ratio of
 * seasons with mints to seasons without mints. This will allow for a more accurate simulation of its fluctuation.
 */
export function calculateGaugeVAPYs(
  tokens: i32[],
  earnedBeans: BigDecimal,
  gaugeLpPoints: BigDecimal[],
  gaugeLpDepositedBdv: BigDecimal[],
  nonGaugeDepositedBdv: BigDecimal,
  gaugeLpOptimalPercentBdv: BigDecimal[],
  initialR: BigDecimal,
  siloDepositedBeanBdv: BigDecimal,
  siloStalk: BigDecimal,
  catchUpRate: BigDecimal,
  season: BigInt,
  germinatingBeanBdv: BigDecimal[],
  gaugeLpGerminatingBdv: BigDecimal[][],
  nonGaugeGerminatingBdv: BigDecimal[],
  staticSeeds: Array<BigDecimal | null>
): BigDecimal[][] {
  // Fixed-point arithmetic is used here to achieve >40% speedup over using BigDecimal
  // Everything is still passed to this function as BigDecimal so we can normalize the precision as set here
  const PRECISION: u8 = 12;
  const PRECISION_BI = toBigInt(ONE_BD, PRECISION);
  // A larger precision is required for tracking user balances as they can be highly fractional
  const BALANCES_PRECISION: u8 = 18;
  const BALANCES_PRECISION_BI = toBigInt(ONE_BD, BALANCES_PRECISION);

  // Current percentages allocations of each LP
  let currentPercentLpBdv: BigInt[] = [];
  const sumLpBdv = BigDecimal_sum(gaugeLpDepositedBdv);
  for (let i = 0; i < gaugeLpDepositedBdv.length; ++i) {
    currentPercentLpBdv.push(toBigInt(gaugeLpDepositedBdv[i].div(sumLpBdv), PRECISION));
  }

  // Current LP GP allocation per BDV
  let lpGpPerBdv: BigInt[] = [];
  // Copy these input
  let gaugeLpPointsCopy: BigInt[] = [];
  let gaugeLpDepositedBdvCopy: BigInt[] = [];
  for (let i = 0; i < gaugeLpPoints.length; ++i) {
    lpGpPerBdv.push(toBigInt(gaugeLpPoints[i].div(gaugeLpDepositedBdv[i]), PRECISION));
    gaugeLpDepositedBdvCopy.push(toBigInt(gaugeLpDepositedBdv[i], PRECISION));
    gaugeLpPointsCopy.push(toBigInt(gaugeLpPoints[i], PRECISION));
  }

  let r = initialR;
  let catchUpSeasons = toBigInt(catchUpRate, PRECISION);
  let siloReward = toBigInt(earnedBeans, PRECISION);
  let beanBdv = toBigInt(siloDepositedBeanBdv, PRECISION);
  let totalStalk = toBigInt(siloStalk, PRECISION);
  let gaugeBdv = beanBdv.plus(BigInt_sum(gaugeLpDepositedBdvCopy));
  let nonGaugeDepositedBdv_ = toBigInt(nonGaugeDepositedBdv, PRECISION);
  let totalBdv = gaugeBdv.plus(nonGaugeDepositedBdv_);
  let largestLpGpPerBdv = BigInt_max(lpGpPerBdv);

  const startingGrownStalk = totalStalk.times(PRECISION_BI).div(totalBdv).minus(toBigInt(ONE_BD, PRECISION));
  let userBeans: BigInt[] = [];
  let userLp: BigInt[] = [];
  let userStalk: BigInt[] = [];
  for (let i = 0; i < tokens.length; ++i) {
    userBeans.push(toBigInt(tokens[i] == -1 ? ONE_BD : ZERO_BD, BALANCES_PRECISION));
    userLp.push(toBigInt(tokens[i] == -1 ? ZERO_BD : ONE_BD, BALANCES_PRECISION));
    // Initial stalk from deposit + avg grown stalk
    userStalk.push(toBigInt(ONE_BD, BALANCES_PRECISION).plus(startingGrownStalk.times(BI_10.pow(BALANCES_PRECISION - PRECISION))));
  }

  const SEED_PRECISION = toBigInt(BigDecimal.fromString("10000"), PRECISION);
  const ONE_YEAR = 8760;
  for (let i = 0; i < ONE_YEAR; ++i) {
    r = updateR(r, deltaRFromState(earnedBeans));
    const rScaled = toBigInt(scaleR(r), PRECISION);

    // Add germinating bdv to actual bdv in the first 2 simulated seasons
    if (i < 2) {
      const index = season.mod(BigInt.fromString("2")) == ZERO_BI ? 1 : 0;
      beanBdv = beanBdv.plus(toBigInt(germinatingBeanBdv[index], PRECISION));
      for (let j = 0; j < gaugeLpDepositedBdvCopy.length; ++j) {
        gaugeLpDepositedBdvCopy[j] = gaugeLpDepositedBdvCopy[j].plus(toBigInt(gaugeLpGerminatingBdv[j][index], PRECISION));
      }
      gaugeBdv = beanBdv.plus(BigInt_sum(gaugeLpDepositedBdvCopy));
      nonGaugeDepositedBdv_ = nonGaugeDepositedBdv_.plus(toBigInt(nonGaugeGerminatingBdv[index], PRECISION));
      totalBdv = gaugeBdv.plus(nonGaugeDepositedBdv_);
    }

    if (gaugeLpPoints.length > 1) {
      for (let j = 0; j < gaugeLpDepositedBdvCopy.length; ++i) {
        gaugeLpPointsCopy[j] = updateGaugePoints(gaugeLpPointsCopy[j], currentPercentLpBdv[j], gaugeLpOptimalPercentBdv[j]);
        lpGpPerBdv[j] = gaugeLpPointsCopy[j].times(PRECISION_BI).div(gaugeLpDepositedBdvCopy[j]);
      }
      largestLpGpPerBdv = BigInt_max(lpGpPerBdv);
    }

    const beanGpPerBdv = largestLpGpPerBdv.times(rScaled).div(PRECISION_BI);
    const gpTotal = BigInt_sum(gaugeLpPointsCopy).plus(beanGpPerBdv.times(beanBdv).div(PRECISION_BI));
    const avgGsPerBdv = totalStalk.times(PRECISION_BI).div(totalBdv).minus(toBigInt(ONE_BD, PRECISION));
    const gs = avgGsPerBdv.times(PRECISION_BI).div(catchUpSeasons).times(gaugeBdv).div(PRECISION_BI);
    const beanSeeds = gs.times(PRECISION_BI).div(gpTotal).times(beanGpPerBdv).div(PRECISION_BI).times(SEED_PRECISION);

    totalStalk = totalStalk.plus(gs).plus(siloReward);
    gaugeBdv = gaugeBdv.plus(siloReward);
    totalBdv = totalBdv.plus(siloReward);
    beanBdv = beanBdv.plus(siloReward);

    for (let j = 0; j < tokens.length; ++j) {
      // Set this equal to the number of seeds for whichever is the user' deposited lp asset
      let lpSeeds = toBigInt(ZERO_BD, PRECISION);
      if (tokens[j] != -1) {
        if (tokens[j] < 0) {
          lpSeeds = toBigInt(staticSeeds[j]!, PRECISION);
        } else {
          lpSeeds = gs.times(PRECISION_BI).div(gpTotal).times(lpGpPerBdv[tokens[j]]).div(PRECISION_BI).times(SEED_PRECISION);
        }
      }

      // (disabled) - for germinating deposits not receiving seignorage for 2 seasons
      // const userBeanShare = i < 2 ? toBigInt(ZERO_BD, PRECISION) : siloReward.times(userStalk[j]).div(totalStalk);
      const userBeanShare = siloReward.times(userStalk[j]).div(totalStalk);
      userStalk[j] = userStalk[j]
        .plus(userBeanShare)
        .plus(userBeans[j].times(beanSeeds).div(PRECISION_BI).plus(userLp[j].times(lpSeeds).div(PRECISION_BI)).div(SEED_PRECISION));
      userBeans[j] = userBeans[j].plus(userBeanShare);
    }
  }

  let retval: BigDecimal[][] = [];
  for (let i = 0; i < tokens.length; ++i) {
    const beanApy = userBeans[i]
      .plus(userLp[i])
      .minus(BALANCES_PRECISION_BI)
      .times(toBigInt(BigDecimal.fromString("100"), PRECISION));
    const stalkApy = userStalk[i].minus(BALANCES_PRECISION_BI).times(toBigInt(BigDecimal.fromString("100"), PRECISION));
    // Add 2 to each precision to divide by 100 (i.e. 25% is .25 not 25)
    retval.push([toDecimal(beanApy, PRECISION + BALANCES_PRECISION + 2), toDecimal(stalkApy, PRECISION + BALANCES_PRECISION + 2)]);
  }

  return retval;
}

function updateFertAPY(t: i32, timestamp: BigInt, window: i32): void {
  let siloYield = loadSiloYield(t, window);
  let fertilizerYield = loadFertilizerYield(t, window);
  let fertilizer = loadFertilizer(FERTILIZER);
  let beanstalk = Beanstalk.bind(BEANSTALK);
  if (t < 6534) {
    let currentFertHumidity = beanstalk.try_getCurrentHumidity();
    fertilizerYield.humidity = BigDecimal.fromString(currentFertHumidity.reverted ? "500" : currentFertHumidity.value.toString()).div(
      BigDecimal.fromString("1000")
    );
  } else {
    // Avoid contract call for season >= 6534 since humidity will always be 0.2
    // This gives a significant performance improvement, but will need to be revisited if humidity ever changes
    fertilizerYield.humidity = BigDecimal.fromString("0.2");
  }

  fertilizerYield.outstandingFert = fertilizer.supply;
  fertilizerYield.beansPerSeasonEMA = siloYield.beansPerSeasonEMA;
  fertilizerYield.deltaBpf = fertilizerYield.beansPerSeasonEMA.div(BigDecimal.fromString(fertilizerYield.outstandingFert.toString()));
  fertilizerYield.simpleAPY =
    fertilizerYield.deltaBpf == ZERO_BD
      ? ZERO_BD
      : fertilizerYield.humidity.div(
          BigDecimal.fromString("1").plus(fertilizerYield.humidity).div(fertilizerYield.deltaBpf).div(BigDecimal.fromString("8760"))
        );
  fertilizerYield.createdAt = timestamp;
  fertilizerYield.save();
}

function updateR(R: BigDecimal, change: BigDecimal): BigDecimal {
  const newR = R.plus(change);
  if (newR > ONE_BD) {
    return ONE_BD;
  } else if (newR < ZERO_BD) {
    return ZERO_BD;
  }
  return newR;
}

function scaleR(R: BigDecimal): BigDecimal {
  return BigDecimal.fromString("0.5").plus(BigDecimal.fromString("0.5").times(R));
}

// For now we return an increasing R value only when there are no beans minted over the period.
// In the future this needs to take into account beanstalk state and the frequency of how many seasons have mints
function deltaRFromState(earnedBeans: BigDecimal): BigDecimal {
  if (earnedBeans == ZERO_BD) {
    return BigDecimal.fromString("0.01");
  }
  return BigDecimal.fromString("-0.01");
}

// TODO: implement the various gauge point functions and choose which one to call based on the stored selector
// see {GaugePointFacet.defaultGaugePointFunction} for implementation.
// This will become relevant once there are multiple functions implemented in the contract.
function updateGaugePoints(gaugePoints: BigInt, currentPercent: BigInt, optimalPercent: BigDecimal): BigInt {
  return gaugePoints;
}
