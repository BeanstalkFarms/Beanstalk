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
  WELL_LP_AMOUNT,
  WETH_SWAP_AMOUNT,
  WETH_USD_AMOUNT
} from "./helpers/Constants";
import { boreDefaultWell } from "./helpers/Aquifer";
import { mockAddLiquidity, mockRemoveLiquidity, mockRemoveLiquidityOneBean, mockRemoveLiquidityOneWeth } from "./helpers/Liquidity";
import { dayFromTimestamp, hourFromTimestamp } from "../../subgraph-core/utils/Dates";
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

describe("Well Entity: Liquidity Event Tests", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  // TODO: Sync

  describe("Add Liquidity - Balanced", () => {
    test("Deposit counter incremented", () => {
      mockAddLiquidity();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeDepositCount", "1");
    });
    test("Token Balances updated", () => {
      mockAddLiquidity();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1]);
    });
    test("Token Balances USD updated", () => {
      mockAddLiquidity();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reservesUSD;

      assert.stringEquals(BEAN_USD_AMOUNT.toString(), endingBalances[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.toString(), endingBalances[1].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BigDecimal.fromString("2")).toString(), updatedStore.totalLiquidityUSD.toString());
    });
    test("Liquidity Token balance", () => {
      mockAddLiquidity();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.toString());
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
    test("Token volumes updated", () => {
      //TODO
    });
    test("Token volumes USD updated", () => {
      //TODO
    });
  });

  describe("Add Liquidity - Multiple Imbalanced", () => {
    // TODO
  });

  describe("Remove Liquidity - Balanced", () => {
    test("Withdraw counter incremented", () => {
      mockRemoveLiquidity();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      mockRemoveLiquidity();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(ZERO_BI.minus(BEAN_SWAP_AMOUNT), endingBalances[0]);
      assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      mockRemoveLiquidity();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", ZERO_BI.minus(WELL_LP_AMOUNT).toString());
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

  describe("Remove Liquidity One - Bean", () => {
    test("Withdraw counter incremented", () => {
      mockAddLiquidity();
      mockAddLiquidity();
      mockRemoveLiquidityOneBean();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      mockAddLiquidity();
      mockAddLiquidity();
      mockRemoveLiquidityOneBean();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BigInt.fromI32(2)), endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      mockAddLiquidity();
      mockAddLiquidity();
      mockRemoveLiquidityOneBean();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.toString());
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

  describe("Remove Liquidity One - WETH", () => {
    test("Withdraw counter incremented", () => {
      mockRemoveLiquidityOneWeth();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      mockRemoveLiquidityOneWeth();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(ZERO_BI, endingBalances[0]);
      assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      mockRemoveLiquidityOneWeth();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", ZERO_BI.minus(WELL_LP_AMOUNT).toString());
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

  describe("Remove Liquidity - Multiple Imbalanced", () => {
    // TODO
  });
});
