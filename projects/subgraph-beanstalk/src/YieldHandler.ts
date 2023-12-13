import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Beanstalk } from "../generated/Season-Replanted/Beanstalk";
import { BEANSTALK, FERTILIZER } from "../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD } from "../../subgraph-core/utils/Decimals";
import { loadFertilizer } from "./utils/Fertilizer";
import { loadFertilizerYield } from "./utils/FertilizerYield";
import { loadSilo, loadSiloHourlySnapshot, loadSiloYield, loadTokenYield, loadWhitelistTokenSetting } from "./utils/SiloEntities";
// import {
// import { HISTORIC_VAPY } from "./utils/HistoricYield";

const MAX_WINDOW = 720;

// Note: minimum value of `t` is 6075
export function updateBeanEMA(t: i32, timestamp: BigInt): void {
  let siloYield = loadSiloYield(t);

  // When less then MAX_WINDOW data points are available,
  // smooth over whatever is available. Otherwise use MAX_WINDOW.
  siloYield.u = t - 6074 < MAX_WINDOW ? t - 6074 : MAX_WINDOW;

  // Calculate the current beta value
  siloYield.beta = BigDecimal.fromString("2").div(BigDecimal.fromString((siloYield.u + 1).toString()));

  // Perform the EMA Calculation
  let currentEMA = ZERO_BD;
  let priorEMA = ZERO_BD;

  if (siloYield.u < MAX_WINDOW) {
    // Recalculate EMA from initial season since beta has changed
    for (let i = 6075; i <= t; i++) {
      let season = loadSiloHourlySnapshot(BEANSTALK, i, timestamp);
      currentEMA = toDecimal(season.deltaBeanMints).minus(priorEMA).times(siloYield.beta).plus(priorEMA);
      priorEMA = currentEMA;
    }
  } else {
    // Calculate EMA for the prior 720 seasons
    for (let i = t - MAX_WINDOW + 1; i <= t; i++) {
      let season = loadSiloHourlySnapshot(BEANSTALK, i, timestamp);
      currentEMA = toDecimal(season.deltaBeanMints).minus(priorEMA).times(siloYield.beta).plus(priorEMA);
      priorEMA = currentEMA;
    }
  }

  siloYield.beansPerSeasonEMA = currentEMA;
  siloYield.createdAt = timestamp;
  siloYield.save();

  // This iterates through 8760 times to calculate the silo APY
  let silo = loadSilo(BEANSTALK);

  // Pull from historically calculated values prior to season 15457 rather than iterating

  let cacheIndex = -1;
  if (t <= 8000) {
    cacheIndex = t - 6075;

    siloYield.twoSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][1]);
    siloYield.twoSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][2]);
    siloYield.threeSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][3]);
    siloYield.threeSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][4]);
    siloYield.threePointTwoFiveSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][5]);
    siloYield.threePointTwoFiveSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][6]);
    siloYield.fourSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][7]);
    siloYield.fourSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][8]);
    siloYield.fourPointFiveSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][9]);
    siloYield.fourPointFiveSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][10]);
    siloYield.zeroSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_8_000[cacheIndex][11]);
  } else if (t <= 10000) {
    cacheIndex = t - 8001;

    siloYield.twoSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][1]);
    siloYield.twoSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][2]);
    siloYield.threeSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][3]);
    siloYield.threeSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][4]);
    siloYield.threePointTwoFiveSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][5]);
    siloYield.threePointTwoFiveSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][6]);
    siloYield.fourSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][7]);
    siloYield.fourSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][8]);
    siloYield.fourPointFiveSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][9]);
    siloYield.fourPointFiveSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][10]);
    siloYield.zeroSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_10_000[cacheIndex][11]);
  } else if (t <= 12000) {
    cacheIndex = t - 10001;

    siloYield.twoSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][1]);
    siloYield.twoSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][2]);
    siloYield.threeSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][3]);
    siloYield.threeSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][4]);
    siloYield.threePointTwoFiveSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][5]);
    siloYield.threePointTwoFiveSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][6]);
    siloYield.fourSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][7]);
    siloYield.fourSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][8]);
    siloYield.fourPointFiveSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][9]);
    siloYield.fourPointFiveSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][10]);
    siloYield.zeroSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_12_000[cacheIndex][11]);
  } else if (t <= 14000) {
    cacheIndex = t - 12001;

    siloYield.twoSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][1]);
    siloYield.twoSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][2]);
    siloYield.threeSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][3]);
    siloYield.threeSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][4]);
    siloYield.threePointTwoFiveSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][5]);
    siloYield.threePointTwoFiveSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][6]);
    siloYield.fourSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][7]);
    siloYield.fourSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][8]);
    siloYield.fourPointFiveSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][9]);
    siloYield.fourPointFiveSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][10]);
    siloYield.zeroSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_14_000[cacheIndex][11]);
  } else if (t <= 15457) {
    cacheIndex = t - 14001;

    siloYield.twoSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][1]);
    siloYield.twoSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][2]);
    siloYield.threeSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][3]);
    siloYield.threeSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][4]);
    siloYield.threePointTwoFiveSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][5]);
    siloYield.threePointTwoFiveSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][6]);
    siloYield.fourSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][7]);
    siloYield.fourSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][8]);
    siloYield.fourPointFiveSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][9]);
    siloYield.fourPointFiveSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][10]);
    siloYield.zeroSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY_16_000[cacheIndex][11]);
  } else {
    let twoSeedAPY = calculateAPY(currentEMA, BigDecimal.fromString("2"), silo.stalk, silo.seeds);
    siloYield.twoSeedBeanAPY = twoSeedAPY[0];
    siloYield.twoSeedStalkAPY = twoSeedAPY[1];
    let fourSeedAPY = calculateAPY(currentEMA, BigDecimal.fromString("4"), silo.stalk, silo.seeds);
    siloYield.fourSeedBeanAPY = fourSeedAPY[0];
    siloYield.fourSeedStalkAPY = fourSeedAPY[1];
    siloYield.zeroSeedBeanAPY = calculateAPY(currentEMA, ZERO_BD, silo.stalk, silo.seeds)[0];

    // BIP-37 Seed changes
    let threeSeedAPY = calculateAPY(currentEMA, BigDecimal.fromString("3"), silo.stalk, silo.seeds);
    siloYield.threeSeedBeanAPY = threeSeedAPY[0];
    siloYield.threeSeedStalkAPY = threeSeedAPY[1];
    let threePointTwoFiveSeedAPY = calculateAPY(currentEMA, BigDecimal.fromString("3.25"), silo.stalk, silo.seeds);
    siloYield.threePointTwoFiveSeedBeanAPY = threePointTwoFiveSeedAPY[0];
    siloYield.threePointTwoFiveSeedStalkAPY = threePointTwoFiveSeedAPY[1];
    let fourPointFiveSeedAPY = calculateAPY(currentEMA, BigDecimal.fromString("4.5"), silo.stalk, silo.seeds);
    siloYield.fourPointFiveSeedBeanAPY = fourPointFiveSeedAPY[0];
    siloYield.fourPointFiveSeedStalkAPY = fourPointFiveSeedAPY[1];
  }
  siloYield.save();

  updateFertAPY(t, timestamp);
}

/**
 *
 * @param n An estimate of number of Beans minted to the Silo per Season on average
 * over the next 720 Seasons. This could be pre-calculated as a SMA, EMA, or otherwise.
 * @param seedsPerBDV The number of seeds per BDV Beanstalk rewards for this token.
 * @returns
 */

export function calculateAPY(n: BigDecimal, seedsPerBDV: BigDecimal, stalk: BigInt, seeds: BigInt): StaticArray<BigDecimal> {
  // Initialize sequence
  let C = toDecimal(seeds); // Init: Total Seeds
  let K = toDecimal(stalk, 10); // Init: Total Stalk
  let b = seedsPerBDV.div(BigDecimal.fromString("3")); // Init: User BDV
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
  let STALK_PER_BEAN = BigDecimal.fromString("0.0003"); // 3 Seeds per Bean * 1/10,000 Stalk per Seed

  for (let i = 0; i < 8760; i++) {
    // Each Season, Farmer's ownership = `current Stalk / total Stalk`
    let ownership = k.div(K);
    let newBDV = n.times(ownership);

    // Total Seeds: each seignorage Bean => 3 Seeds
    C_i = C.plus(n.times(BigDecimal.fromString("3")));
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
function updateFertAPY(t: i32, timestamp: BigInt): void {
  let siloYield = loadSiloYield(t);
  let fertilizerYield = loadFertilizerYield(t);
  let fertilizer = loadFertilizer(FERTILIZER);
  let beanstalk = Beanstalk.bind(BEANSTALK);
  let currentFertHumidity = beanstalk.try_getCurrentHumidity();

  fertilizerYield.humidity = BigDecimal.fromString(currentFertHumidity.reverted ? "500" : currentFertHumidity.value.toString()).div(
    BigDecimal.fromString("1000")
  );
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
