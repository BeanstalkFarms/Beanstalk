import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BEAN_ERC20, WETH } from "../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { boreDefaultWell } from "./helpers/Aquifer";
import { AQUIFER, IMPLEMENTATION, PUMP, WELL } from "./helpers/Constants";
import { initL1Version } from "./entity-mocking/MockVersion";

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
      // TODO: Upgrade
    });
    test("WellUpgradeHistory entity tracks each upgrade", () => {
      //
    });

    test("Well entity stores current component data", () => {
      //
    });
  });
});
