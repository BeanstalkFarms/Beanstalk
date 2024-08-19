import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { toDecimal } from "../../../../subgraph-core/utils/Decimals";

/**
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
