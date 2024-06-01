import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BEAN_ERC20, WETH } from "../../subgraph-core/utils/Constants";
import { ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadWell } from "../src/utils/Well";
import {
  ACCOUNT_ENTITY_TYPE,
  BEAN_SWAP_AMOUNT,
  DEPOSIT_ENTITY_TYPE,
  SWAP_ACCOUNT,
  WELL,
  WELL_LP_AMOUNT,
  WETH_SWAP_AMOUNT,
  WITHDRAW_ENTITY_TYPE
} from "./helpers/Constants";
import { boreDefaultWell } from "./helpers/Aquifer";
import { mockAddLiquidity, mockRemoveLiquidity, mockRemoveLiquidityOneBean, loadWithdraw } from "./helpers/Liquidity";
import { loadDeposit } from "./helpers/Liquidity";
import { BigInt } from "@graphprotocol/graph-ts";

describe("Deposit/Withdraw Entities", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  describe("AddLiquidity", () => {
    test("Deposit entity exists", () => {
      let id = mockAddLiquidity();
      assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "id", id);
      assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "well", WELL.toHexString());
      assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "liquidity", WELL_LP_AMOUNT.toString());

      let updatedStore = loadDeposit(id);
      let tokens = updatedStore.tokens;

      assert.bytesEquals(BEAN_ERC20, tokens[0]);
      assert.bytesEquals(WETH, tokens[1]);

      let reserves = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, reserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, reserves[1]);
    });
    test("Account entity exists", () => {
      let id = mockAddLiquidity();
      assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
    });
  });

  describe("RemoveLiquidity", () => {
    test("Withdraw entity exists", () => {
      let id = mockRemoveLiquidity();
      assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "id", id);
      assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "well", WELL.toHexString());
      assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "liquidity", WELL_LP_AMOUNT.toString());

      let updatedStore = loadWithdraw(id);
      let tokens = updatedStore.tokens;

      assert.bytesEquals(BEAN_ERC20, tokens[0]);
      assert.bytesEquals(WETH, tokens[1]);

      let reserves = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, reserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, reserves[1]);
    });
    test("Account entity exists", () => {
      let id = mockRemoveLiquidity();
      assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
    });
  });

  describe("RemoveLiquidityOneToken", () => {
    test("Withdraw entity exists", () => {
      mockAddLiquidity();
      mockAddLiquidity();
      let id = mockRemoveLiquidityOneBean();
      assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "id", id);
      assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "well", WELL.toHexString());
      assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "liquidity", WELL_LP_AMOUNT.toString());

      let updatedStore = loadWithdraw(id);
      let tokens = updatedStore.tokens;

      assert.bytesEquals(BEAN_ERC20, tokens[0]);
      assert.bytesEquals(WETH, tokens[1]);

      let reserves = updatedStore.reserves;

      let updatedWell = loadWell(WELL);
      let wellReserves = updatedWell.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, reserves[0]);
      assert.bigIntEquals(ZERO_BI, reserves[1]);
      assert.bigIntEquals(BEAN_SWAP_AMOUNT, wellReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BigInt.fromU32(2)), wellReserves[1]);
    });
    test("Account entity exists", () => {
      mockAddLiquidity();
      mockAddLiquidity();
      let id = mockRemoveLiquidityOneBean();
      assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
    });
  });

  describe("Sync", () => {
    // TODO
  });
});
