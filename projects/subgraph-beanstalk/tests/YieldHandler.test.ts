import { BigInt, BigDecimal, log } from "@graphprotocol/graph-ts";
import { afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import * as YieldHandler from "../src/YieldHandler";
import { ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";

describe("APY Calculations", () => {
  describe("Pre-Gauge", () => {
    test("No Bean mints", () => {
      const apy = YieldHandler.calculateAPYPreGauge(
        BigDecimal.fromString("0"), // n
        BigDecimal.fromString("2"), // seedsPerBDV
        BigDecimal.fromString("2"), // seedsPerBeanBDV
        BigInt.fromString("10000000000000"), // stalk
        BigInt.fromString("2000000000") // seeds
      );

      log.info(`bean apy: {}`, [apy[0].toString()]);
      log.info(`stalk apy: {}`, [apy[1].toString()]);
      assert.assertTrue((apy[0] as BigDecimal).equals(BigDecimal.fromString("0")));
      assert.assertTrue((apy[1] as BigDecimal).gt(BigDecimal.fromString("0")));
    });

    // Sequence recreated here for testing:
    // https://docs.google.com/spreadsheets/d/1h7pPEydeAMze_uZMZzodTB3kvEXz_dGGje4KKm83gRM/edit#gid=1845553589
    test("Yields are higher with 4 seeds", () => {
      const apy2 = YieldHandler.calculateAPYPreGauge(
        BigDecimal.fromString("1"),
        BigDecimal.fromString("2"),
        BigDecimal.fromString("2"),
        BigInt.fromString("10000000000000"),
        BigInt.fromString("2000000000")
      );
      const apy4 = YieldHandler.calculateAPYPreGauge(
        BigDecimal.fromString("1"),
        BigDecimal.fromString("4"),
        BigDecimal.fromString("4"),
        BigInt.fromString("10000000000000"),
        BigInt.fromString("2000000000")
      );

      log.info(`bean apy (2 seeds): {}`, [(apy2[0] as BigDecimal).toString()]);
      log.info(`bean apy (4 seeds): {}`, [(apy4[0] as BigDecimal).toString()]);
      log.info(`stalk apy (2 seeds): {}`, [(apy2[1] as BigDecimal).toString()]);
      log.info(`stalk apy (4 seeds): {}`, [(apy4[1] as BigDecimal).toString()]);
      assert.assertTrue((apy4[0] as BigDecimal).gt(apy2[0] as BigDecimal));
      assert.assertTrue((apy4[1] as BigDecimal).gt(apy2[1] as BigDecimal));
    });
  });

  describe("With Seed Gauge", () => {
    test("Bean yield", () => {
      // Calculated in a single call - 5000 ms
      const apy = YieldHandler.calculateGaugeVAPYs(
        [-1, 0, -2],
        BigDecimal.fromString("100"),
        [BigDecimal.fromString("100")],
        [BigDecimal.fromString("899088")],
        BigDecimal.fromString("43974853"),
        [BigDecimal.fromString("100")],
        BigDecimal.fromString("0.33"),
        BigDecimal.fromString("2798474"),
        BigDecimal.fromString("161540879"),
        BigDecimal.fromString("4320"),
        ZERO_BI,
        [ZERO_BD, ZERO_BD],
        [[ZERO_BD], [ZERO_BD]],
        [ZERO_BD, ZERO_BD],
        [null, null, ZERO_BD]
      );

      for (let i = 0; i < apy.length; ++i) {
        log.info(`bean apy: {}`, [(apy[i][0] as BigDecimal).toString()]);
        log.info(`stalk apy: {}`, [(apy[i][1] as BigDecimal).toString()]);
      }

      // Calculated separately - 8750ms
      // using unripe bdv 19556945+24417908
      // for (let i = -1; i <= 0; ++i) {
      //   const apy = YieldHandler.calculateGaugeVAPYs(
      //     [i],
      //     BigDecimal.fromString("100"),
      //     [BigDecimal.fromString("100")],
      //     [BigDecimal.fromString("899088")],
      //     BigDecimal.fromString("43974853"),
      //     [BigDecimal.fromString("100")],
      //     BigDecimal.fromString("0.33"),
      //     BigDecimal.fromString("2798474"),
      //     BigDecimal.fromString("161540879"),
      //     BigDecimal.fromString("4320"),
      //     ZERO_BI,
      //     [ZERO_BD, ZERO_BD],
      //     [[ZERO_BD], [ZERO_BD]],
      //     [ZERO_BD, ZERO_BD],
      //     [null]
      //   );

      //   log.info(`bean apy: {}`, [(apy[0][0] as BigDecimal).toString()]);
      //   log.info(`stalk apy: {}`, [(apy[0][1] as BigDecimal).toString()]);
      // }

      // const apyUnripe = YieldHandler.calculateGaugeVAPYs(
      //   [-2],
      //   BigDecimal.fromString("100"),
      //   [BigDecimal.fromString("100")],
      //   [BigDecimal.fromString("899088")],
      //   BigDecimal.fromString("43974853"),
      //   [BigDecimal.fromString("100")],
      //   BigDecimal.fromString("0.33"),
      //   BigDecimal.fromString("2798474"),
      //   BigDecimal.fromString("161540879"),
      //   BigDecimal.fromString("4320"),
      //   ZERO_BI,
      //   [ZERO_BD, ZERO_BD],
      //   [[ZERO_BD], [ZERO_BD]],
      //   [ZERO_BD, ZERO_BD],
      //   [ZERO_BD]
      // );

      // log.info(`bean apy: {}`, [(apyUnripe[0][0] as BigDecimal).toString()]);
      // log.info(`stalk apy: {}`, [(apyUnripe[0][1] as BigDecimal).toString()]);
    });
  });
});
