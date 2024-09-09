import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BEAN_ERC20, WETH } from "../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { BI_10, ZERO_BI } from "../../subgraph-core/utils/Decimals";
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
import { mockAddLiquidity, mockRemoveLiquidity, mockRemoveLiquidityOneBean, loadWithdraw, mockSync } from "./helpers/Liquidity";
import { loadDeposit } from "./helpers/Liquidity";
import { BigInt } from "@graphprotocol/graph-ts";

describe("Deposit/Withdraw Entities", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  test("AddLiquidity event", () => {
    const deltaLiquidity = [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT];
    let id = mockAddLiquidity(deltaLiquidity);
    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "id", id);
    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "well", WELL.toHexString());
    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "liquidity", WELL_LP_AMOUNT.toString());
    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "reserves", "[" + deltaLiquidity[0].toString() + ", " + deltaLiquidity[1].toString() + "]");

    let updatedStore = loadDeposit(id);
    let tokens = updatedStore.tokens;

    assert.bytesEquals(BEAN_ERC20, tokens[0]);
    assert.bytesEquals(WETH, tokens[1]);

    let reserves = updatedStore.reserves;

    assert.bigIntEquals(BEAN_SWAP_AMOUNT, reserves[0]);
    assert.bigIntEquals(WETH_SWAP_AMOUNT, reserves[1]);

    // Account entity exists
    assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
  });

  test("Sync event", () => {
    const initialReserves = [BigInt.fromU32(50000).times(BI_10.pow(6)), BigInt.fromU32(20).times(BI_10.pow(18))];
    const syncdReserves = [BigInt.fromU32(52000).times(BI_10.pow(6)), BigInt.fromU32(205).times(BI_10.pow(17))];
    mockAddLiquidity(initialReserves);

    const deltaLiquidity = [syncdReserves[0].minus(initialReserves[0]), syncdReserves[1].minus(initialReserves[1])];
    const lpAmount = BI_10;
    const id = mockSync(syncdReserves, lpAmount);

    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "id", id);
    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "well", WELL.toHexString());
    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "liquidity", lpAmount.toString());
    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "reserves", "[" + deltaLiquidity[0].toString() + ", " + deltaLiquidity[1].toString() + "]");

    // Account entity exists
    assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
  });

  test("RemoveLiquidity event", () => {
    const deltaLiquidity = [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT];
    let id = mockRemoveLiquidity(deltaLiquidity);
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "id", id);
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "well", WELL.toHexString());
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "liquidity", WELL_LP_AMOUNT.toString());
    assert.fieldEquals(
      WITHDRAW_ENTITY_TYPE,
      id,
      "reserves",
      "[" + deltaLiquidity[0].toString() + ", " + deltaLiquidity[1].toString() + "]"
    );

    let updatedStore = loadWithdraw(id);
    let tokens = updatedStore.tokens;

    assert.bytesEquals(BEAN_ERC20, tokens[0]);
    assert.bytesEquals(WETH, tokens[1]);

    let reserves = updatedStore.reserves;

    assert.bigIntEquals(BEAN_SWAP_AMOUNT, reserves[0]);
    assert.bigIntEquals(WETH_SWAP_AMOUNT, reserves[1]);

    // Account entity exists
    assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
  });

  test("RemoveLiquidityOneToken event", () => {
    const deltaLiquidity = [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT];
    mockAddLiquidity(deltaLiquidity);
    mockAddLiquidity(deltaLiquidity);
    let id = mockRemoveLiquidityOneBean();
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "id", id);
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "well", WELL.toHexString());
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "liquidity", WELL_LP_AMOUNT.toString());
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "reserves", "[" + BEAN_SWAP_AMOUNT.toString() + ", 0]");

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

    // Account entity exists
    assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
  });
});
