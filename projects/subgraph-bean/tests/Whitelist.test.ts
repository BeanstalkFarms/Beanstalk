import { beforeEach, beforeAll, afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BEAN_3CRV, BEAN_ERC20, BEAN_WETH_CP2_WELL, BEAN_WETH_CP2_WELL_BLOCK } from "../../subgraph-core/constants/BeanstalkEth";
import { createDewhitelistTokenEvent } from "./event-mocking/Beanstalk";
import { setWhitelistedPools } from "./entity-mocking/MockBean";
import { handleDewhitelistToken } from "../src/handlers/BeanstalkHandler";
import { initL1Version } from "./entity-mocking/MockVersion";

describe("Whitelisting", () => {
  beforeEach(() => {
    initL1Version();
  });
  afterEach(() => {
    // log.debug("clearing the store", []);
    clearStore();
  });

  test("Dewhitelist", () => {
    setWhitelistedPools([BEAN_3CRV, BEAN_WETH_CP2_WELL]);

    const event = createDewhitelistTokenEvent(BEAN_3CRV);
    event.block.number = BEAN_WETH_CP2_WELL_BLOCK;
    handleDewhitelistToken(event);

    assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "pools", "[" + BEAN_WETH_CP2_WELL.toHexString() + "]");
    assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "dewhitelistedPools", "[" + BEAN_3CRV.toHexString() + "]");
  });
});
