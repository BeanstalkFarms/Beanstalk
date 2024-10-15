import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BEAN_ERC20, WETH } from "../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { boreDefaultWell, boreUpgradeableWell } from "./helpers/Aquifer";
import { AQUIFER, IMPLEMENTATION, PUMP, WELL } from "./helpers/Constants";
import { initL1Version } from "./entity-mocking/MockVersion";
import { UPGRADEABLE_MAPPING } from "../src/utils/UpgradeableMapping";

describe("Aquifer Well Deployment", () => {
  beforeEach(() => {
    initL1Version();
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  test("Component entities exist", () => {
    assert.fieldEquals("Aquifer", AQUIFER.toHexString(), "id", AQUIFER.toHexString());
    assert.fieldEquals("Implementation", IMPLEMENTATION.toHexString(), "id", IMPLEMENTATION.toHexString());
    assert.fieldEquals("Well", WELL.toHexString(), "id", WELL.toHexString());
    assert.fieldEquals("Pump", PUMP.toHexString(), "id", PUMP.toHexString());
    assert.fieldEquals("Token", BEAN_ERC20.toHexString(), "id", BEAN_ERC20.toHexString());
    assert.fieldEquals("Token", WETH.toHexString(), "id", WETH.toHexString());
  });

  describe("Upgradeable Wells", () => {
    beforeEach(() => {
      assert.entityCount("Well", 1);
      assert.entityCount("WellUpgradeHistory", 1);
      boreUpgradeableWell(0);
      boreUpgradeableWell(1);
    });
    test("WellUpgradeHistory entity tracks each upgrade", () => {
      assert.entityCount("WellUpgradeHistory", 3);
      assert.fieldEquals(
        "WellUpgradeHistory",
        UPGRADEABLE_MAPPING[0].proxy.toHexString() + "-0",
        "boredWell",
        UPGRADEABLE_MAPPING[0].boredWells[0].toHexString()
      );
      assert.fieldEquals(
        "WellUpgradeHistory",
        UPGRADEABLE_MAPPING[0].proxy.toHexString() + "-1",
        "boredWell",
        UPGRADEABLE_MAPPING[0].boredWells[1].toHexString()
      );
    });

    test("Well entity stores current component data", () => {
      // Default + upgradeable well
      assert.entityCount("Well", 2);
      assert.fieldEquals(
        "Well",
        UPGRADEABLE_MAPPING[0].proxy.toHexString(),
        "boredWell",
        UPGRADEABLE_MAPPING[0].boredWells[1].toHexString()
      );
    });
  });
});
