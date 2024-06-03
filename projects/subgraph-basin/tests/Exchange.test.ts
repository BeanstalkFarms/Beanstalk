import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadWell } from "../src/utils/Well";
import {
  BEAN_SWAP_AMOUNT,
  BEAN_USD_AMOUNT,
  CURRENT_BLOCK_TIMESTAMP,
  WELL,
  WELL_DAILY_ENTITY_TYPE,
  WELL_ENTITY_TYPE,
  WELL_HOURLY_ENTITY_TYPE,
  WETH_SWAP_AMOUNT,
  WETH_USD_AMOUNT
} from "./helpers/Constants";
import { boreDefaultWell } from "./helpers/Aquifer";
import { mockShift, mockSwap } from "./helpers/Swap";
import { mockAddLiquidity } from "./helpers/Liquidity";
import { dayFromTimestamp, hourFromTimestamp } from "../../subgraph-core/utils/Dates";
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { BEAN_ERC20 } from "../../subgraph-core/utils/Constants";

describe("Well Entity: Exchange Tests", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  describe("Swap", () => {
    test("Swap counter incremented", () => {
      mockSwap();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeSwapCount", "1");
    });
    test("Token Balances updated", () => {
      mockSwap();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1]);
    });
    test("Token Volumes updated", () => {
      mockSwap();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.cumulativeVolumeReserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1]);
    });
    test("Token Volumes USD updated", () => {
      mockAddLiquidity();
      mockAddLiquidity();
      mockSwap();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.cumulativeVolumeReservesUSD;

      assert.stringEquals(BEAN_USD_AMOUNT.toString(), endingBalances[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.toString(), endingBalances[1].toString());
      assert.stringEquals(
        BEAN_USD_AMOUNT.plus(WETH_USD_AMOUNT).div(BigDecimal.fromString("2")).toString(),
        updatedStore.cumulativeVolumeUSD.toString()
      );
    });
    test("Previous day snapshot entity created", () => {
      mockSwap();

      let dayID = dayFromTimestamp(CURRENT_BLOCK_TIMESTAMP, 8 * 60 * 60) - 1;
      let daySnapshotID = WELL.concatI32(dayID);

      let hourID = hourFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let hourSnapshotID = WELL.concatI32(hourID);

      assert.fieldEquals(WELL_DAILY_ENTITY_TYPE, daySnapshotID.toHexString(), "id", daySnapshotID.toHexString());
      assert.fieldEquals(WELL_HOURLY_ENTITY_TYPE, hourSnapshotID.toHexString(), "id", hourSnapshotID.toHexString());
    });
  });

  describe("Shift", () => {
    beforeEach(() => {
      mockAddLiquidity();
      mockAddLiquidity();
      // Buy beans for 1 weth
      mockShift([BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT.times(BigInt.fromU32(3))], BEAN_ERC20, BEAN_SWAP_AMOUNT);
    });
    test("Swap counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeSwapCount", "1");
    });
    test("Token Balances updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BigInt.fromU32(3)), endingBalances[1]);
    });
    test("Token Volumes updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.cumulativeVolumeReserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BigInt.fromU32(3)), endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BigInt.fromU32(3)), endingBalances[1]);
    });
    test("Token Volumes USD updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.cumulativeVolumeReservesUSD;

      assert.stringEquals(BEAN_USD_AMOUNT.times(BigDecimal.fromString("3")).toString(), endingBalances[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BigDecimal.fromString("3")).toString(), endingBalances[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.toString(), updatedStore.cumulativeVolumeUSD.toString());
    });
  });
});
