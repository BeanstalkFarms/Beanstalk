import { beforeEach, beforeAll, afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BigInt, Bytes, BigDecimal, log } from "@graphprotocol/graph-ts";
import { loadBean } from "../src/utils/Bean";
import {
  BEAN_ERC20,
  BEAN_WETH_CP2_WELL,
  BEAN_WETH_CP2_WELL_BLOCK,
  BEAN_WETH_UNRIPE_MIGRATION_BLOCK,
  UNRIPE_BEAN,
  UNRIPE_BEAN_3CRV
} from "../../subgraph-core/utils/Constants";
import { BI_10, ONE_BI, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import {
  mockGetRecapPaidPercent,
  mockGetTotalUnderlying,
  mockSeedGaugeLockedBeans,
  mockSeedGaugeLockedBeansReverts
} from "./call-mocking/Beanstalk";
import { handleChop } from "../src/BeanstalkHandler";
import { mockBeanstalkEvent } from "../../subgraph-core/tests/event-mocking/Util";
import { Chop } from "../generated/Beanstalk/Beanstalk";
import { loadOrCreatePool } from "../src/utils/Pool";
import { calcLockedBeans, LibLockedUnderlying_getPercentLockedUnderlying } from "../src/utils/LockedBeans";
import { mockERC20TokenSupply } from "../../subgraph-core/tests/event-mocking/Tokens";

describe("L2SR", () => {
  afterEach(() => {
    mockSeedGaugeLockedBeansReverts();
    clearStore();
  });

  describe("Locked Beans Calculation", () => {
    test("Calculation - block 19736119", () => {
      mockSeedGaugeLockedBeansReverts();
      mockERC20TokenSupply(UNRIPE_BEAN, BigInt.fromString("109291429462926"));
      mockERC20TokenSupply(UNRIPE_BEAN_3CRV, BigInt.fromString("88784724593495"));
      const recapPaidPercent = BigDecimal.fromString("0.045288");
      const lockedUnderlyingBean = LibLockedUnderlying_getPercentLockedUnderlying(UNRIPE_BEAN, recapPaidPercent);
      const lockedUnderlyingLp = LibLockedUnderlying_getPercentLockedUnderlying(UNRIPE_BEAN_3CRV, recapPaidPercent);

      assert.assertTrue(lockedUnderlyingBean.equals(BigDecimal.fromString("0.6620572696973799")));
      assert.assertTrue(lockedUnderlyingLp.equals(BigDecimal.fromString("0.6620572696973799")));

      let pool = loadOrCreatePool(BEAN_WETH_CP2_WELL.toHexString(), BEAN_WETH_UNRIPE_MIGRATION_BLOCK);
      pool.reserves = [BigInt.fromString("14544448316811"), BigInt.fromString("4511715111212845829348")];
      pool.save();

      mockGetRecapPaidPercent(BigDecimal.fromString("0.045288"));
      mockGetTotalUnderlying(UNRIPE_BEAN, BigInt.fromString("24584183207621"));
      mockGetTotalUnderlying(UNRIPE_BEAN_3CRV, BigInt.fromString("246676046856767267392929"));
      mockERC20TokenSupply(BEAN_WETH_CP2_WELL, BigInt.fromString("256164804872196346760208"));

      const lockedBeans = calcLockedBeans(BEAN_WETH_UNRIPE_MIGRATION_BLOCK);
      log.debug("answer {}", [lockedBeans.toString()]);
    });
  });

  describe("Post-Replant", () => {
    beforeEach(() => {
      let bean = loadBean(BEAN_ERC20.toHexString());
      bean.supply = BigInt.fromString("5000").times(BI_10.pow(6));
      bean.save();

      let pool = loadOrCreatePool(BEAN_WETH_CP2_WELL.toHexString(), BEAN_WETH_CP2_WELL_BLOCK);
      pool.reserves = [BigInt.fromString("1000").times(BI_10.pow(6)), ONE_BI];
      pool.save();
    });

    test("No Locked Beans", () => {
      const lockedBeans = ZERO_BI;
      mockSeedGaugeLockedBeans(lockedBeans);
      const event = changetype<Chop>(mockBeanstalkEvent());
      event.block.number = BEAN_WETH_CP2_WELL_BLOCK;
      handleChop(event);

      assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "lockedBeans", lockedBeans.toString());
      assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "supplyInPegLP", "0.2");
    });

    test("Locked Beans Post-Gauge", () => {
      const lockedBeans = BigInt.fromString("3000").times(BI_10.pow(6));
      mockSeedGaugeLockedBeans(lockedBeans);
      const event = changetype<Chop>(mockBeanstalkEvent());
      event.block.number = BEAN_WETH_CP2_WELL_BLOCK;
      handleChop(event);

      assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "lockedBeans", lockedBeans.toString());
      assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "supplyInPegLP", "0.5");
    });

    // Its unclear how to mock a specific amount of locked beans. The Pre-gauge calculation is verified above
    // test("Locked Beans Pre-Gauge", () => {
    //   const lockedBeans = BigInt.fromString("1000").times(BI_10.pow(6));
    //   mockPreGaugeLockedBeans(lockedBeans);
    //   const event = changetype<Chop>(mockBeanstalkEvent());
    //   event.block.number = BEAN_WETH_CP2_WELL_BLOCK;
    //   handleChop(event);

    //   assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "lockedBeans", lockedBeans.toString());
    //   assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "supplyInPegLP", "0.25");
    // });
  });
});
