import { clearStore, beforeEach, afterEach, describe, test, assert } from "matchstick-as/assembly/index";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { initL2Version } from "./entity-mocking/MockVersion";
import { init, preUnpause } from "../src/utils/b3-migration/Init";
import {
  AQUIFER,
  BEAN_ERC20,
  BEANSTALK,
  FERTILIZER,
  UNRIPE_BEAN,
  UNRIPE_LP
} from "../../subgraph-core/constants/raw/BeanstalkArbConstants";
import {
  FIELD_INITIAL_VALUES,
  POD_MARKETPLACE_INITIAL_VALUES,
  SEASON_INITIAL,
  UNRIPE_TOKENS_INITIAL_VALUES
} from "../cache-builder/results/B3Migration_arb";
import {
  handleAddMigratedDeposit,
  handleInternalBalanceMigrated,
  handleMigratedPlot,
  handleMigratedPodListing,
  handleMigratedPodOrder
} from "../src/handlers/legacy/ArbitrumMigrationHandler";
import {
  createAddMigratedDepositEvent,
  createInternalBalanceMigratedEvent,
  createMigratedPlotEvent,
  createMigratedPodListingEvent,
  createMigratedPodOrderEvent
} from "./event-mocking/Migration";
import { BI_10, ONE_BI, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import { handleTransferSingle } from "../src/handlers/BarnHandler";
import { createTransferSingleEvent } from "./event-mocking/Barn";
import { ADDRESS_ZERO } from "../../subgraph-core/utils/Bytes";

const account = AQUIFER;

describe("Beanstalk 3 Migration", () => {
  beforeEach(() => {
    initL2Version();
    init(mockBlock());
    preUnpause(mockBlock());
  });
  afterEach(() => {
    clearStore();
  });

  describe("Initial entity data carry-over", () => {
    test("Field entity initialization", () => {
      assert.fieldEquals("Field", BEANSTALK.toHexString(), "numberOfSowers", FIELD_INITIAL_VALUES.numberOfSowers.toString());
      assert.fieldEquals("Field", BEANSTALK.toHexString(), "sownBeans", FIELD_INITIAL_VALUES.sownBeans.toString());
      assert.fieldEquals(
        "FieldHourlySnapshot",
        BEANSTALK.toHexString() + "-" + SEASON_INITIAL.toString(),
        "sownBeans",
        FIELD_INITIAL_VALUES.sownBeans.toString()
      );
      assert.fieldEquals("FieldHourlySnapshot", BEANSTALK.toHexString() + "-" + SEASON_INITIAL.toString(), "deltaSownBeans", "0");
    });

    test("PodMarketplace entity initialization", () => {
      assert.fieldEquals("PodMarketplace", "0", "filledListedPods", POD_MARKETPLACE_INITIAL_VALUES.filledListedPods.toString());
      assert.fieldEquals("PodMarketplace", "0", "beanVolume", POD_MARKETPLACE_INITIAL_VALUES.beanVolume.toString());
      assert.fieldEquals(
        "PodMarketplaceHourlySnapshot",
        "0-" + SEASON_INITIAL.toString(),
        "beanVolume",
        POD_MARKETPLACE_INITIAL_VALUES.beanVolume.toString()
      );
      assert.fieldEquals("PodMarketplaceHourlySnapshot", "0-" + SEASON_INITIAL.toString(), "deltaBeanVolume", "0");
    });

    test("UnripeTokens entity initialization", () => {
      assert.fieldEquals(
        "UnripeToken",
        UNRIPE_BEAN.toHexString(),
        "totalChoppedAmount",
        UNRIPE_TOKENS_INITIAL_VALUES[0].totalChoppedAmount.toString()
      );
      assert.fieldEquals(
        "UnripeToken",
        UNRIPE_LP.toHexString(),
        "totalChoppedBdvReceived",
        UNRIPE_TOKENS_INITIAL_VALUES[1].totalChoppedBdvReceived.toString()
      );
      assert.fieldEquals(
        "UnripeTokenHourlySnapshot",
        UNRIPE_BEAN.toHexString() + "-" + SEASON_INITIAL.toString(),
        "totalChoppedBdvReceived",
        UNRIPE_TOKENS_INITIAL_VALUES[0].totalChoppedBdvReceived.toString()
      );
      assert.fieldEquals(
        "UnripeTokenHourlySnapshot",
        UNRIPE_BEAN.toHexString() + "-" + SEASON_INITIAL.toString(),
        "deltaTotalChoppedBdvReceived",
        "0"
      );
    });
  });

  describe("Asset Migration Events", () => {
    test("AddMigratedDeposit", () => {
      const stem = BigInt.fromU32(2500);
      const amount = BigInt.fromU32(500).times(BI_10.pow(6));
      handleAddMigratedDeposit(createAddMigratedDepositEvent(account, BEAN_ERC20, stem, amount, amount));
      assert.fieldEquals(
        "SiloDeposit",
        account.toHexString() + "-" + BEAN_ERC20.toHexString() + "-stem-" + stem.toString(),
        "stemV31",
        stem.toString()
      );
    });
    test("MigratedPlot", () => {
      const index = BigInt.fromU32(250000000).times(BI_10.pow(6));
      const amount = BigInt.fromU32(1500).times(BI_10.pow(6));
      handleMigratedPlot(createMigratedPlotEvent(account, index, amount));
      assert.fieldEquals("Plot", index.toString(), "source", "Reseed Migrated");
      assert.fieldEquals("Field", account.toHexString(), "unharvestablePods", amount.toString());
    });
    test("MigratedPodListing", () => {
      const index = BigInt.fromU32(500).times(BI_10.pow(6));
      const amount = BigInt.fromU32(1500).times(BI_10.pow(6));
      handleMigratedPodListing(
        createMigratedPodListingEvent(
          account,
          ZERO_BI,
          index,
          ZERO_BI,
          amount,
          BigInt.fromU32(50000), // 0.05
          BigInt.fromU32(7500).times(BI_10.pow(6)),
          ONE_BI,
          0
        )
      );
      assert.fieldEquals("PodListing", account.toHexString() + "-" + index.toString(), "amount", amount.toString());
    });
    test("MigratedPodOrder", () => {
      const orderId = Bytes.fromHexString("0xabcd");
      const beanAmount = BigInt.fromU32(500).times(BI_10.pow(6));
      handleMigratedPodOrder(
        createMigratedPodOrderEvent(
          account,
          orderId,
          beanAmount,
          ZERO_BI,
          BigInt.fromU32(50000), // 0.05
          BigInt.fromU32(7500).times(BI_10.pow(6)),
          ONE_BI
        )
      );
      assert.fieldEquals("PodOrder", orderId.toString(), "beanAmount", beanAmount.toString());
    });
    test("InternalBalanceMigrated", () => {
      const beanAmount = BigInt.fromU32(2500).times(BI_10.pow(6));
      handleInternalBalanceMigrated(createInternalBalanceMigratedEvent(account, BEAN_ERC20, beanAmount));
      assert.fieldEquals("SiloAsset", account.toHexString() + "-" + BEAN_ERC20.toHexString(), "farmAmount", beanAmount.toString());
    });
  });
  test("Barn - Fertilizer Minted during Reseed (no contract view functions available)", () => {
    const fertId = BigInt.fromU32(6000000);
    const amount = BigInt.fromU32(1500);
    handleTransferSingle(createTransferSingleEvent(account, ADDRESS_ZERO, account, fertId, amount));
    assert.fieldEquals("Fertilizer", FERTILIZER.toHexString(), "supply", amount.toString());
    assert.fieldEquals("FertilizerToken", fertId.toString(), "supply", amount.toString());
    assert.fieldEquals("FertilizerToken", fertId.toString(), "humidity", "500");
    assert.fieldEquals("FertilizerToken", fertId.toString(), "season", "6074");
    assert.fieldEquals("FertilizerToken", fertId.toString(), "startBpf", "0");
    assert.fieldEquals("FertilizerBalance", fertId.toString() + "-" + account.toHexString(), "amount", amount.toString());

    const fertId2 = BigInt.fromU32(2373025);
    const amount2 = BigInt.fromU32(700);
    handleTransferSingle(createTransferSingleEvent(account, ADDRESS_ZERO, account, fertId2, amount2));
    assert.fieldEquals("Fertilizer", FERTILIZER.toHexString(), "supply", amount.plus(amount2).toString());
    assert.fieldEquals("FertilizerToken", fertId2.toString(), "supply", amount2.toString());
    assert.fieldEquals("FertilizerToken", fertId2.toString(), "humidity", "124");
    assert.fieldEquals("FertilizerToken", fertId2.toString(), "season", "6326");
    assert.fieldEquals("FertilizerToken", fertId2.toString(), "startBpf", "133025");
    assert.fieldEquals("FertilizerBalance", fertId2.toString() + "-" + account.toHexString(), "amount", amount2.toString());
  });
});
