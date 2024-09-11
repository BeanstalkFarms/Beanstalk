import { clearStore, beforeEach, afterEach, describe, test, assert } from "matchstick-as/assembly/index";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { initL1Version } from "./entity-mocking/MockVersion";
import { handleMigration } from "../src/utils/b3-migration/Init";
import { BEANSTALK, UNRIPE_BEAN, UNRIPE_LP } from "../../subgraph-core/constants/raw/BeanstalkEthConstants";
import {
  FIELD_INITIAL_VALUES,
  POD_MARKETPLACE_INITIAL_VALUES,
  SEASON_INITIAL,
  UNRIPE_TOKENS_INITIAL_VALUES
} from "../cache-builder/results/B3Migration_arb";

describe("Beanstalk 3 Migration", () => {
  beforeEach(() => {
    // NOTE: it may be more appropriate to init l2 version, but this shouldnt affect the tests
    // (aside from having to use L1 addresses in this test)
    initL1Version();
    handleMigration(mockBlock());
  });
  afterEach(() => {
    clearStore();
  });

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
    assert.fieldEquals("PodMarketplaceHourlySnapshot", BEANSTALK.toHexString() + "-" + SEASON_INITIAL.toString(), "deltaBeanVolume", "0");
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
