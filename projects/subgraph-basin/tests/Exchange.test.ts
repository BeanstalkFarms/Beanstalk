import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BEAN_ERC20, WETH } from "../../subgraph-core/utils/Constants";
import { ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadWell } from "../src/utils/Well";
import {
  ACCOUNT_ENTITY_TYPE,
  BEAN_SWAP_AMOUNT,
  BEAN_USD_AMOUNT,
  CURRENT_BLOCK_TIMESTAMP,
  SWAP_ACCOUNT,
  SWAP_ENTITY_TYPE,
  WELL,
  WELL_DAILY_ENTITY_TYPE,
  WELL_ENTITY_TYPE,
  WELL_HOURLY_ENTITY_TYPE,
  WETH_SWAP_AMOUNT,
  WETH_USD_AMOUNT
} from "./helpers/Constants";
import { boreDefaultWell } from "./helpers/Aquifer";
import { createDefaultSwap } from "./helpers/Swap";
import { mockAddLiquidity } from "./helpers/Liquidity";
import { dayFromTimestamp, hourFromTimestamp } from "../../subgraph-core/utils/Dates";
import { BigDecimal } from "@graphprotocol/graph-ts";

describe("Well Entity: Exchange Tests", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  // TODO: Shift

  describe("Swap", () => {
    test("Swap counter incremented", () => {
      createDefaultSwap();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeSwapCount", "1");
    });

    test("Token Balances updated", () => {
      createDefaultSwap();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1]);
    });

    test("Token Volumes updated", () => {
      createDefaultSwap();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.cumulativeVolumeReserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1]);
    });

    test("Token Volumes USD updated", () => {
      mockAddLiquidity();
      mockAddLiquidity();
      createDefaultSwap();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.cumulativeVolumeReservesUSD;

      assert.stringEquals(BEAN_USD_AMOUNT.toString(), endingBalances[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.toString(), endingBalances[1].toString());
      assert.stringEquals(
        BEAN_USD_AMOUNT.plus(WETH_USD_AMOUNT).div(BigDecimal.fromString("2")).toString(),
        updatedStore.cumulativeVolumeUSD.toString()
      );
    });
  });

  test("Previous day snapshot entity created", () => {
    mockAddLiquidity();

    let dayID = dayFromTimestamp(CURRENT_BLOCK_TIMESTAMP, 8 * 60 * 60) - 1;
    let daySnapshotID = WELL.concatI32(dayID);

    let hourID = hourFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
    let hourSnapshotID = WELL.concatI32(hourID);

    assert.fieldEquals(WELL_DAILY_ENTITY_TYPE, daySnapshotID.toHexString(), "id", daySnapshotID.toHexString());
    assert.fieldEquals(WELL_HOURLY_ENTITY_TYPE, hourSnapshotID.toHexString(), "id", hourSnapshotID.toHexString());
  });
});

describe("Swap Entity", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  describe("Swap", () => {
    test("Swap entity", () => {
      let id = createDefaultSwap();
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "id", id);
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "well", WELL.toHexString());
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "fromToken", BEAN_ERC20.toHexString());
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "amountIn", BEAN_SWAP_AMOUNT.toString());
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "toToken", WETH.toHexString());
      assert.fieldEquals(SWAP_ENTITY_TYPE, id, "amountOut", WETH_SWAP_AMOUNT.toString());
    });
    test("Account entity exists", () => {
      let id = createDefaultSwap();
      assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
    });
  });

  describe("Shift", () => {
    // TODO
  });
});
