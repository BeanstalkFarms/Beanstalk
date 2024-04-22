import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Beanstalk } from "../generated/Season-Replanted/Beanstalk";
import { BEANSTALK, BEAN_ERC20, FERTILIZER } from "../../subgraph-core/utils/Constants";
import { ONE_BD, ONE_BI, toDecimal, ZERO_BD } from "../../subgraph-core/utils/Decimals";
import { loadFertilizer } from "./utils/Fertilizer";
import { loadFertilizerYield } from "./utils/FertilizerYield";
import { loadSilo, loadSiloHourlySnapshot, loadSiloYield, loadTokenYield, loadWhitelistTokenSetting } from "./utils/SiloEntities";
import { BigDecimal_max, BigDecimal_sum, BigInt_max, BigInt_sum } from "../../subgraph-core/utils/ArrayMath";

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

  // Step through the whitelisted tokens and calculate the silo APY

  let beanGrownStalk = loadWhitelistTokenSetting(BEAN_ERC20).stalkEarnedPerSeason;

  for (let i = 0; i < siloYield.whitelistedTokens.length; i++) {
    let token = Address.fromString(siloYield.whitelistedTokens[i]);
    let siloSettings = loadWhitelistTokenSetting(token);
    let tokenYield = loadTokenYield(token, t, window);

    let tokenAPY = calculateAPY(
      currentEMA,
      toDecimal(siloSettings.stalkEarnedPerSeason), // old seeds
      toDecimal(beanGrownStalk), // old seeds per bean
      silo.stalk,
      silo.seeds
    );
    tokenYield.beanAPY = tokenAPY[0];
    tokenYield.stalkAPY = tokenAPY[1];
    tokenYield.createdAt = timestamp;
    tokenYield.save();
  }

  updateFertAPY(t, timestamp, window);
}

/**
 *
 * @param n An estimate of number of Beans minted to the Silo per Season on average
 * over the next 720 Seasons. This could be pre-calculated as a SMA, EMA, or otherwise.
 * @param seedsPerBDV The number of seeds per BDV Beanstalk rewards for this token.
 * @returns
 */

export function calculateAPY(
  n: BigDecimal,
  seedsPerBDV: BigDecimal,
  seedsPerBeanBDV: BigDecimal,
  stalk: BigInt,
  seeds: BigInt
): StaticArray<BigDecimal> {
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
  let apys = new StaticArray<BigDecimal>(2);
  apys[0] = b.minus(b_start); // beanAPY
  apys[1] = k.minus(k_start); // stalkAPY

  return apys;
}

/**
 * Calculates silo Bean/Stalk vAPY when Seed Gauge is active.
 *
 * All of the array parameters should not be empty and be the same length.
 *
 * @param token Which gauge lp token to calculate the apy for. corresponds to an index in the various array parameters.
 *        for Bean or other non-gauge token, provide -1
 * @param earnedBeans The average number of beans earned per season to use
 * @param gaugeLpPoints Array of gauge points assigned to each gauge lp. With a single lp, there will be one entry
 * @param gaugeLpDepositedBdv Array of deposited bdv corresponding to each gauge lp
 * @param nonGaugeBdv Amount of (whitelisted) deposited bdv that is not tracked by the gauge system
 * @param gaugeLpOptimalPercentBdv Array of optimal bdv percentages for each lp
 * @param initialR Initial ratio of max LP gauge points per bdv to Bean gauge points per bdv
 * @param siloDepositedBeanBdv The total number of Beans in the silo
 * @param siloStalk The total amount of stalk in the silo
 * @param catchUpRate Target number of hours for a deposit's grown stalk to catch up
 * @param staticSeeds Provided when `token` does not have its seeds dynamically changed by gauge
 *
 * TODO: how to specify unripe here? only difference is zero seeds
 *
 * TODO: account for germinating in the first 2 seasons of deposit.
 *  Also account for already germinating assets from other deposits
 *
 * Future work includes improvement of the `r` value simulation. This involves using Beanstalk's current state,
 * including L2SR and debt level (temperature cases). Also can be improved by tracking an expected ratio of
 * seasons with mints to seasons without mints. This will allow for a more accurate simulation of its fluctuation.
 */
export function calculateGaugeVAPY(
  token: i32,
  earnedBeans: BigDecimal,
  gaugeLpPoints: BigDecimal[],
  gaugeLpDepositedBdv: BigDecimal[],
  nonGaugeBdv: BigDecimal,
  gaugeLpOptimalPercentBdv: BigDecimal[],
  initialR: BigDecimal,
  siloDepositedBeanBdv: BigDecimal,
  siloStalk: BigDecimal,
  catchUpRate: BigDecimal,
  staticSeeds: BigDecimal | null = null
): BigDecimal[] {
  // Current percentages allocations of each LP
  let currentPercentLpBdv: BigDecimal[] = [];
  const sumLpBdv = BigDecimal_sum(gaugeLpDepositedBdv);
  for (let i = 0; i < gaugeLpDepositedBdv.length; ++i) {
    currentPercentLpBdv.push(gaugeLpDepositedBdv[i].div(sumLpBdv));
  }

  // Current LP GP allocation per BDV
  let lpGpPerBdv: BigDecimal[] = [];
  // Copy this input
  let gaugePointLp: BigDecimal[] = [];
  for (let i = 0; i < gaugeLpPoints.length; ++i) {
    lpGpPerBdv.push(gaugeLpPoints[i].div(gaugeLpDepositedBdv[i]));
    gaugePointLp.push(gaugeLpPoints[i]);
  }

  let r = initialR;
  let beanBdv = siloDepositedBeanBdv;
  let totalStalk = siloStalk;
  let gaugeBdv = beanBdv.plus(BigDecimal_sum(gaugeLpDepositedBdv));
  let totalBdv = gaugeBdv.plus(nonGaugeBdv);
  let userBeans = ONE_BD;
  let userStalk = ONE_BD;
  let largestLpGpPerBdv = BigDecimal_max(lpGpPerBdv);

  const SEED_PRECISION = BigDecimal.fromString("10000");
  const ONE_YEAR = 8760;
  for (let i = 0; i < ONE_YEAR; ++i) {
    r = updateR(r, deltaRFromState(null));
    const rScaled = scaleR(r);

    if (gaugeLpPoints.length > 1) {
      for (let j = 0; j < gaugeLpDepositedBdv.length; ++i) {
        gaugePointLp[j] = updateGaugePoints(gaugePointLp[j], currentPercentLpBdv[j], gaugeLpOptimalPercentBdv[j]);
        lpGpPerBdv[j] = gaugePointLp[j].div(gaugeLpDepositedBdv[j]);
      }
      largestLpGpPerBdv = BigDecimal_max(lpGpPerBdv);
    }

    const beanGpPerBdv = largestLpGpPerBdv.times(rScaled);
    // log.debug("bean gp per bdv {}", [beanGpPerBdv.toString()]);
    const gpTotal = BigDecimal_sum(gaugePointLp).plus(beanGpPerBdv.times(beanBdv));
    // log.debug("gpTotal {}", [gpTotal.toString()]);
    const avgGsPerBdv = totalStalk.div(totalBdv).minus(ONE_BD);
    // log.debug("avgGsPerBdv {}", [avgGsPerBdv.toString()]);
    const gs = avgGsPerBdv.div(catchUpRate).times(gaugeBdv);
    // log.debug("gs {}", [gs.toString()]);
    const beanSeeds = gs.div(gpTotal).times(beanGpPerBdv).times(SEED_PRECISION);
    // log.debug("beanSeeds {}", [beanSeeds.toString()]);
    // const beanEthSeeds = // Set this equal to the number of seeds for the user deposited asset. No need to calculate for each lp

    totalStalk = totalStalk.plus(gs).plus(earnedBeans);
    // log.debug("totalStalk {}", [totalStalk.toString()]);
    gaugeBdv = gaugeBdv.plus(earnedBeans);
    totalBdv = totalBdv.plus(earnedBeans);
    beanBdv = beanBdv.plus(earnedBeans);
    const userBeanShare = earnedBeans.times(userStalk).div(totalStalk);
    // log.debug("userBeanShare {}", [userBeanShare.toString()]);
    userStalk = userStalk.plus(userBeanShare).plus(userBeans.times(beanSeeds).div(SEED_PRECISION));
    // log.debug("userStalk {}", [userStalk.toString()]);
    userBeans = userBeans.plus(userBeanShare);
    // log.debug("userBeans {}", [userBeans.toString()]);
  }

  const beanApy = userBeans.minus(ONE_BD).times(BigDecimal.fromString("100"));
  const stalkApy = userStalk.minus(ONE_BD).times(BigDecimal.fromString("100"));

  return [beanApy, stalkApy];
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

function deltaRFromState(state: BigInt | null): BigDecimal {
  return BigDecimal.fromString("0.01"); // TODO: change to negative
}

// TODO: implement the various gauge point functions and choose which one to call based on the stored selector
// see {GaugePointFacet.defaultGaugePointFunction} for implementation.
function updateGaugePoints(gaugePoints: BigDecimal, currentPercent: BigDecimal, optimalPercent: BigDecimal): BigDecimal {
  return BigDecimal.fromString("100");
}
