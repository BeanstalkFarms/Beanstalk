import { clearStore, beforeEach, afterEach, describe, test, assert } from "matchstick-as/assembly/index";
import { init } from "../src/utils/b3-migration/Init";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { BEAN_ERC20 } from "../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { BEAN_INITIAL_VALUES } from "../cache-builder/results/B3Migration_arb";
import { initL1Version } from "./entity-mocking/MockVersion";

describe("Beanstalk 3 Migration", () => {
  beforeEach(() => {
    // NOTE: it may be more appropriate to init l2 version, but this shouldnt affect the tests
    // (aside from having to use L1 addresses in this test)
    initL1Version();
    init(mockBlock());
  });
  afterEach(() => {
    clearStore();
  });

  test("Bean entity initialization", () => {
    assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "volume", BEAN_INITIAL_VALUES.volume.toString());
    assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "crosses", BEAN_INITIAL_VALUES.crosses.toString());
    assert.fieldEquals(
      "BeanHourlySnapshot",
      BEAN_ERC20.toHexString() + "-" + BEAN_INITIAL_VALUES.lastSeason.toString(),
      "crosses",
      BEAN_INITIAL_VALUES.crosses.toString()
    );
  });
});
