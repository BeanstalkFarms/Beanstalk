import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BEAN_ERC20, WETH } from "../../subgraph-core/utils/Constants";
import { ACCOUNT_ENTITY_TYPE, BEAN_SWAP_AMOUNT, SWAP_ACCOUNT, SWAP_ENTITY_TYPE, WELL, WETH_SWAP_AMOUNT } from "./helpers/Constants";
import { boreDefaultWell } from "./helpers/Aquifer";
import { mockSwap } from "./helpers/Swap";

describe("Swap Entity", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  describe("Swap", () => {
    test("Swap entity", () => {
      let id = mockSwap();
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "id", id);
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "well", WELL.toHexString());
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "fromToken", BEAN_ERC20.toHexString());
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "amountIn", BEAN_SWAP_AMOUNT.toString());
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "toToken", WETH.toHexString());
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "amountOut", WETH_SWAP_AMOUNT.toString());
    });
    test("Account entity exists", () => {
      let id = mockSwap();
      assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
    });
  });

  describe("Shift", () => {
    // TODO
  });
});
