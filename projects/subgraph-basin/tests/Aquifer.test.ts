import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BEAN_ERC20, WETH } from "../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { boreDefaultWell } from "./helpers/Aquifer";
import { AQUIFER, PUMP, WELL } from "./helpers/Constants";
import { initL1Version } from "./entity-mocking/MockVersion";

describe("Aquifer Well Deployment", () => {
  beforeEach(() => {
    initL1Version();
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  test("Aquifer entity exists", () => {
    assert.fieldEquals("Aquifer", AQUIFER.toHexString(), "id", AQUIFER.toHexString());
  });

  test("Well entity exists", () => {
    assert.fieldEquals("Well", WELL.toHexString(), "id", WELL.toHexString());
  });

  test("Token entities exists", () => {
    assert.fieldEquals("Token", BEAN_ERC20.toHexString(), "id", BEAN_ERC20.toHexString());
    assert.fieldEquals("Token", WETH.toHexString(), "id", WETH.toHexString());
  });

  test("Pump entity exists", () => {
    assert.fieldEquals("Pump", PUMP.toHexString() + "-" + WELL.toHexString(), "id", PUMP.toHexString() + "-" + WELL.toHexString());
  });
});
