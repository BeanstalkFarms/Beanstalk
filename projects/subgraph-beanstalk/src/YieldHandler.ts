import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Beanstalk } from "../generated/Season-Replanted/Beanstalk";
import { BEANSTALK, FERTILIZER } from "../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD } from "../../subgraph-core/utils/Decimals";
import { loadFertilizer } from "./utils/Fertilizer";
import { loadFertilizerYield } from "./utils/FertilizerYield";
import { loadSilo, loadSiloHourlySnapshot } from "./utils/Silo";
import { loadSiloYield } from "./utils/SiloYield";
import { HISTORIC_VAPY } from "./utils/HistoricYield";

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

  // Pull from historically calculated values prior to season 14280 rather than iterating
  if (t <= 14280) {
    for (let i = 0; i < HISTORIC_VAPY.length; i++) {
      if (t.toString() == HISTORIC_VAPY[i][0]) {
        siloYield.twoSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY[i][1]);
        siloYield.twoSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY[i][2]);
        siloYield.fourSeedBeanAPY = BigDecimal.fromString(HISTORIC_VAPY[i][3]);
        siloYield.fourSeedStalkAPY = BigDecimal.fromString(HISTORIC_VAPY[i][4]);
      }
    }
  } else {
    let twoSeedAPY = calculateAPY(currentEMA, BigDecimal.fromString("2"), silo.stalk, silo.seeds);
    siloYield.twoSeedBeanAPY = twoSeedAPY[0];
    siloYield.twoSeedStalkAPY = twoSeedAPY[1];
    let fourSeedAPY = calculateAPY(currentEMA, BigDecimal.fromString("4"), silo.stalk, silo.seeds);
    siloYield.fourSeedBeanAPY = fourSeedAPY[0];
    siloYield.fourSeedStalkAPY = fourSeedAPY[1];
  }
  let zeroSeedAPY = calculateAPY(currentEMA, ZERO_BD, silo.stalk, silo.seeds);
  siloYield.zeroSeedBeanAPY = zeroSeedAPY[0];
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
  let b = seedsPerBDV.div(BigDecimal.fromString("2")); // Init: User BDV
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
  let STALK_PER_BEAN = BigDecimal.fromString("0.0002"); // 2 Seeds per Bean * 1/10,000 Stalk per Seed

  for (let i = 0; i < 8760; i++) {
    // Each Season, Farmer's ownership = `current Stalk / total Stalk`
    let ownership = k.div(K);
    let newBDV = n.times(ownership);

    // Total Seeds: each seignorage Bean => 2 Seeds
    C_i = C.plus(n.times(BigDecimal.fromString("2")));
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
