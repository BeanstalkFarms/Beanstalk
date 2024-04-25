import { beforeEach, beforeAll, afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { loadBean } from "../src/utils/Bean";
import { BEAN_3CRV, BEAN_ERC20, BEAN_WETH_CP2_WELL, BEAN_WETH_CP2_WELL_BLOCK } from "../../subgraph-core/utils/Constants";
import { handleDewhitelistToken } from "../src/BeanstalkHandler";
import { createDewhitelistTokenEvent } from "./event-mocking/Beanstalk";

describe("Whitelisting", () => {
  afterEach(() => {
    // log.debug("clearing the store", []);
    clearStore();
  });

  test("Dewhitelist", () => {
    let bean = loadBean(BEAN_ERC20.toHexString());
    bean.pools = [BEAN_3CRV.toHexString(), BEAN_WETH_CP2_WELL.toHexString()];
    bean.save();

    const event = createDewhitelistTokenEvent(BEAN_3CRV.toHexString());
    event.block.number = BEAN_WETH_CP2_WELL_BLOCK;
    handleDewhitelistToken(event);

    assert.fieldEquals("Bean", BEAN_ERC20.toHexString(), "pools", "[" + BEAN_WETH_CP2_WELL.toHexString() + "]");
  });
});
