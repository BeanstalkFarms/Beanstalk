import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Beanstalk } from "../generated/Season-Replanted/Beanstalk";
import { BEANSTALK, BEAN_ERC20, FERTILIZER } from "../../subgraph-core/utils/Constants";
import { ONE_BD, toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
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
import { BigDecimal_sum, f64_sum, f64_max } from "../../subgraph-core/utils/ArrayMath";
import { getGerminatingBdvs } from "./utils/Germinating";
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
  const beansPerSeason: f64 = parseFloat(n.toString());
  let C: f64 = parseFloat(toDecimal(seeds).toString()); // Init: Total Seeds
  let K: f64 = parseFloat(toDecimal(stalk, 10).toString()); // Init: Total Stalk
  let b: f64 = parseFloat(seedsPerBDV.div(seedsPerBeanBDV).toString()); // Init: User BDV
  let k: f64 = 1; // Init: User Stalk

  let _seedsPerBeanBdv: f64 = parseInt(seedsPerBeanBDV.toString());

  // Farmer initial values
  let b_start: f64 = b;
  let k_start: f64 = k;

  // Placeholders for above values during each iteration
  let C_i: f64 = 0;
  let K_i: f64 = 0;
  let b_i: f64 = 0;
  let k_i: f64 = 0;

  // Stalk and Seeds per Deposited Bean.
  let STALK_PER_SEED: f64 = 0.0001; // 1/10,000 Stalk per Seed
  let STALK_PER_BEAN: f64 = parseFloat(seedsPerBeanBDV.div(BigDecimal.fromString("10000")).toString()); // 3 Seeds per Bean * 1/10,000 Stalk per Seed

  for (let i = 0; i < 8760; i++) {
    // Each Season, Farmer's ownership = `current Stalk / total Stalk`
    let ownership: f64 = k / K;
    let newBDV: f64 = beansPerSeason * ownership;

    // Total Seeds: each seignorage Bean => 3 Seeds
    C_i = C + beansPerSeason * _seedsPerBeanBdv;
    // Total Stalk: each seignorage Bean => 1 Stalk, each outstanding Bean => 1/10_000 Stalk
    K_i = K + beansPerSeason + STALK_PER_SEED * C;
    // Farmer BDV: each seignorage Bean => 1 BDV
    b_i = b + newBDV;
    // Farmer Stalk: each 1 BDV => 1 Stalk, each outstanding Bean => d = 1/5_000 Stalk per Bean
    k_i = k + newBDV + STALK_PER_BEAN * b;

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
  let beanApy = b - b_start; // beanAPY
  let stalkApy = k - k_start; // stalkAPY

  return [BigDecimal.fromString(beanApy.toString()), BigDecimal.fromString(stalkApy.toString())];
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
  const _earnedBeans = parseFloat(earnedBeans.toString());

  // Current percentages allocations of each LP
  let currentPercentLpBdv: f64[] = [];
  const sumLpBdv: BigDecimal = BigDecimal_sum(gaugeLpDepositedBdv);
  for (let i = 0; i < gaugeLpDepositedBdv.length; ++i) {
    currentPercentLpBdv.push(parseFloat(gaugeLpDepositedBdv[i].div(sumLpBdv).toString()));
  }

  // Current LP GP allocation per BDV
  let lpGpPerBdv: f64[] = [];
  // Copy these input
  let gaugeLpPointsCopy: f64[] = [];
  let gaugeLpDepositedBdvCopy: f64[] = [];
  for (let i = 0; i < gaugeLpPoints.length; ++i) {
    lpGpPerBdv.push(parseFloat(gaugeLpPoints[i].div(gaugeLpDepositedBdv[i]).toString()));
    gaugeLpDepositedBdvCopy.push(parseFloat(gaugeLpDepositedBdv[i].toString()));
    gaugeLpPointsCopy.push(parseFloat(gaugeLpPoints[i].toString()));
  }

  let r: f64 = parseFloat(initialR.toString());
  let catchUpSeasons: f64 = parseFloat(catchUpRate.toString());
  let siloReward: f64 = parseFloat(earnedBeans.toString());
  let beanBdv: f64 = parseFloat(siloDepositedBeanBdv.toString());
  let totalStalk: f64 = parseFloat(siloStalk.toString());
  let gaugeBdv: f64 = beanBdv + f64_sum(gaugeLpDepositedBdvCopy);
  let _nonGaugeDepositedBdv: f64 = parseFloat(nonGaugeDepositedBdv.toString());
  let totalBdv: f64 = gaugeBdv + _nonGaugeDepositedBdv;
  let largestLpGpPerBdv: f64 = f64_max(lpGpPerBdv);

  const startingGrownStalk: f64 = totalStalk / totalBdv - 1;
  let userBeans: f64[] = [];
  let userLp: f64[] = [];
  let userStalk: f64[] = [];
  let initialStalk: f64[] = [];
  for (let i = 0; i < tokens.length; ++i) {
    userBeans.push(tokens[i] == -1 ? 1 : 0);
    userLp.push(tokens[i] == -1 ? 0 : 1);
    // Initial stalk from deposit + avg grown stalk
    userStalk.push(1 + startingGrownStalk);
    initialStalk.push(userStalk[i]);
  }

  const ONE_YEAR = 8760;
  for (let i = 0; i < ONE_YEAR; ++i) {
    r = updateR(r, deltaRFromState(_earnedBeans));
    const rScaled: f64 = scaleR(r);

    // Add germinating bdv to actual bdv in the first 2 simulated seasons
    if (i < 2) {
      const index = season.mod(BigInt.fromString("2")) == ZERO_BI ? 1 : 0;
      beanBdv = beanBdv + parseFloat(germinatingBeanBdv[index].toString());
      for (let j = 0; j < gaugeLpDepositedBdvCopy.length; ++j) {
        gaugeLpDepositedBdvCopy[j] = gaugeLpDepositedBdvCopy[j] + parseFloat(gaugeLpGerminatingBdv[j][index].toString());
      }
      gaugeBdv = beanBdv + f64_sum(gaugeLpDepositedBdvCopy);
      _nonGaugeDepositedBdv = _nonGaugeDepositedBdv + parseFloat(nonGaugeGerminatingBdv[index].toString());
      totalBdv = gaugeBdv + _nonGaugeDepositedBdv;
    }

    if (gaugeLpPoints.length > 1) {
      for (let j = 0; j < gaugeLpDepositedBdvCopy.length; ++i) {
        gaugeLpPointsCopy[j] = updateGaugePoints(
          gaugeLpPointsCopy[j],
          currentPercentLpBdv[j],
          parseFloat(gaugeLpOptimalPercentBdv[j].toString())
        );
        lpGpPerBdv[j] = gaugeLpPointsCopy[j] / gaugeLpDepositedBdvCopy[j];
      }
      largestLpGpPerBdv = f64_max(lpGpPerBdv);
    }

    const beanGpPerBdv: f64 = largestLpGpPerBdv * rScaled;
    const gpTotal: f64 = f64_sum(gaugeLpPointsCopy) + beanGpPerBdv * beanBdv;
    const avgGsPerBdv: f64 = totalStalk / totalBdv - 1;
    const gs: f64 = (avgGsPerBdv / catchUpSeasons) * gaugeBdv;
    const beanSeeds: f64 = (gs / gpTotal) * beanGpPerBdv;

    totalStalk = totalStalk + gs + siloReward;
    gaugeBdv = gaugeBdv + siloReward;
    totalBdv = totalBdv + siloReward;
    beanBdv = beanBdv + siloReward;

    for (let j = 0; j < tokens.length; ++j) {
      // Set this equal to the number of seeds for whichever is the user' deposited lp asset
      let lpSeeds: f64 = 0.0;
      if (tokens[j] != -1) {
        if (tokens[j] < 0) {
          lpSeeds = parseFloat(staticSeeds[j]!.toString());
        } else {
          lpSeeds = (gs / gpTotal) * lpGpPerBdv[tokens[j]];
        }
      }

      // (disabled) - for germinating deposits not receiving seignorage for 2 seasons
      // const userBeanShare = i < 2 ? toBigInt(ZERO_BD, PRECISION) : siloReward.times(userStalk[j]).div(totalStalk);
      const userBeanShare: f64 = (siloReward * userStalk[j]) / totalStalk;
      userStalk[j] = userStalk[j] + userBeanShare + (userBeans[j] * beanSeeds + userLp[j] * lpSeeds);
      userBeans[j] = userBeans[j] + userBeanShare;
    }
  }

  let retval: BigDecimal[][] = [];
  for (let i = 0; i < tokens.length; ++i) {
    const beanApy = userBeans[i] + userLp[i] - 1;
    const stalkApy = (userStalk[i] - initialStalk[i]) / initialStalk[i];
    retval.push([BigDecimal.fromString(beanApy.toString()), BigDecimal.fromString(stalkApy.toString())]);
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

function updateR(R: f64, change: f64): f64 {
  const newR = R + change;
  if (newR > 1) {
    return 1;
  } else if (newR < 0) {
    return 0;
  }
  return newR;
}

function scaleR(R: f64): f64 {
  return 0.5 + 0.5 * R;
}

// For now we return an increasing R value only when there are no beans minted over the period.
// In the future this needs to take into account beanstalk state and the frequency of how many seasons have mints
function deltaRFromState(earnedBeans: f64): f64 {
  if (earnedBeans == 0) {
    return 0.01;
  }
  return -0.01;
}

// TODO: implement the various gauge point functions and choose which one to call based on the stored selector
// see {GaugePointFacet.defaultGaugePointFunction} for implementation.
// This will become relevant once there are multiple functions implemented in the contract.
function updateGaugePoints(gaugePoints: f64, currentPercent: f64, optimalPercent: f64): f64 {
  return gaugePoints;
}
