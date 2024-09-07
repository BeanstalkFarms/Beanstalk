import { beforeEach, beforeAll, afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BigInt, Bytes, BigDecimal, log } from "@graphprotocol/graph-ts";
import {
  BEAN_3CRV,
  BEAN_ERC20,
  BEAN_WETH_CP2_WELL,
  BEAN_WETH_CP2_WELL_BLOCK,
  BEAN_WETH_UNRIPE_MIGRATION_BLOCK,
  GAUGE_BIP45_BLOCK,
  UNRIPE_BEAN,
  UNRIPE_LP
} from "../../subgraph-core/constants/BeanstalkEth";
import { BI_10, ONE_BI, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import {
  mockGetRecapPaidPercent,
  mockGetTotalUnderlying,
  mockSeedGaugeLockedBeans,
  mockSeedGaugeLockedBeansReverts
} from "./call-mocking/Beanstalk";
import { mockBeanstalkEvent } from "../../subgraph-core/tests/event-mocking/Util";
import { Chop, Convert } from "../generated/Bean-ABIs/Replanted";
import { calcLockedBeans, LibLockedUnderlying_getPercentLockedUnderlying } from "../src/utils/LockedBeans";
import { mockERC20TokenSupply } from "../../subgraph-core/tests/event-mocking/Tokens";
import { TwaOracle } from "../generated/schema";
import { loadOrCreateTwaOracle } from "../src/entities/TwaOracle";
import { loadOrCreatePool } from "../src/entities/Pool";
import { loadBean } from "../src/entities/Bean";
import { handleChop, handleConvert } from "../src/handlers/BeanstalkHandler";
import { createConvertEvent } from "./event-mocking/Beanstalk";
import { initL1Version } from "./entity-mocking/MockVersion";
import { ADDRESS_ZERO } from "../../subgraph-core/utils/Bytes";

const mockReserves = Bytes.fromHexString("0xabcdef");
const mockReservesTime = BigInt.fromString("123456");
const mockTwaOracle = (): TwaOracle => {
  let twaOracle = loadOrCreateTwaOracle(BEAN_WETH_CP2_WELL);
  twaOracle.cumulativeWellReserves = mockReserves;
  twaOracle.cumulativeWellReservesTime = mockReservesTime;
  twaOracle.save();
  return twaOracle;
};

describe("L2SR", () => {
  beforeEach(() => {
    initL1Version();
  });
  afterEach(() => {
    mockSeedGaugeLockedBeansReverts(mockReserves, mockReservesTime);
    clearStore();
  });

  describe("Locked Beans Calculation", () => {
    test("Calculation - block 19736119", () => {
      mockSeedGaugeLockedBeansReverts(mockReserves, mockReservesTime);
      mockERC20TokenSupply(UNRIPE_BEAN, BigInt.fromString("109291429462926"));
      mockERC20TokenSupply(UNRIPE_LP, BigInt.fromString("88784724593495"));
      const recapPaidPercent = BigDecimal.fromString("0.045288");
      const lockedUnderlyingBean = LibLockedUnderlying_getPercentLockedUnderlying(UNRIPE_BEAN, recapPaidPercent);
      const lockedUnderlyingLp = LibLockedUnderlying_getPercentLockedUnderlying(UNRIPE_LP, recapPaidPercent);

      assert.assertTrue(lockedUnderlyingBean.equals(BigDecimal.fromString("0.6620572696973799")));
      assert.assertTrue(lockedUnderlyingLp.equals(BigDecimal.fromString("0.6620572696973799")));

      let pool = loadOrCreatePool(BEAN_WETH_CP2_WELL, BEAN_WETH_UNRIPE_MIGRATION_BLOCK);
      pool.reserves = [BigInt.fromString("14544448316811"), BigInt.fromString("4511715111212845829348")];
      pool.save();

      mockGetRecapPaidPercent(BigDecimal.fromString("0.045288"));
      mockGetTotalUnderlying(UNRIPE_BEAN, BigInt.fromString("24584183207621"));
      mockGetTotalUnderlying(UNRIPE_LP, BigInt.fromString("246676046856767267392929"));
      mockERC20TokenSupply(BEAN_WETH_CP2_WELL, BigInt.fromString("256164804872196346760208"));

      const lockedBeans = calcLockedBeans(BEAN_WETH_UNRIPE_MIGRATION_BLOCK);
      assert.assertTrue(lockedBeans.equals(BigInt.fromString("25548711698424")));
    });
  });

  describe("Post-Replant", () => {
    beforeEach(() => {
      let bean = loadBean(BEAN_ERC20);
      bean.supply = BigInt.fromString("5000").times(BI_10.pow(6));
      bean.save();

      let pool = loadOrCreatePool(BEAN_WETH_CP2_WELL, BEAN_WETH_CP2_WELL_BLOCK);
      pool.reserves = [BigInt.fromString("1000").times(BI_10.pow(6)), ONE_BI];
      pool.save();
    });

    test("No Locked Beans Post-Gauge", () => {
      const lockedBeans = ZERO_BI;
      let twaOracle = mockTwaOracle();
      mockSeedGaugeLockedBeans(twaOracle.cumulativeWellReserves, twaOracle.cumulativeWellReservesTime, lockedBeans);

      const event = changetype<Chop>(mockBeanstalkEvent());
      event.block.number = GAUGE_BIP45_BLOCK;
      handleChop(event);

      assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "lockedBeans", lockedBeans.toString());
      assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "supplyInPegLP", "0.2");
    });

    test("Locked Beans Post-Gauge", () => {
      const lockedBeans = BigInt.fromString("3000").times(BI_10.pow(6));
      let twaOracle = mockTwaOracle();
      mockSeedGaugeLockedBeans(twaOracle.cumulativeWellReserves, twaOracle.cumulativeWellReservesTime, lockedBeans);

      const event = changetype<Chop>(mockBeanstalkEvent());
      event.block.number = GAUGE_BIP45_BLOCK;
      handleChop(event);

      assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "lockedBeans", lockedBeans.toString());
      assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "supplyInPegLP", "0.5");
    });

    test("Chop convert updates Locked Beans", () => {
      const lockedBeans = BigInt.fromString("3000").times(BI_10.pow(6));
      let twaOracle = mockTwaOracle();
      mockSeedGaugeLockedBeans(twaOracle.cumulativeWellReserves, twaOracle.cumulativeWellReservesTime, lockedBeans);

      const event = createConvertEvent(ADDRESS_ZERO, BEAN_3CRV, BEAN_ERC20, ONE_BI, ONE_BI);
      event.block.number = GAUGE_BIP45_BLOCK;
      handleConvert(event);
      assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "lockedBeans", "0");

      const event2 = createConvertEvent(ADDRESS_ZERO, UNRIPE_BEAN, BEAN_ERC20, ONE_BI, ONE_BI);
      event2.block.number = GAUGE_BIP45_BLOCK;
      handleConvert(event2);
      assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "lockedBeans", lockedBeans.toString());
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
