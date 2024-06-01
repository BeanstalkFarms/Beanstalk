import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BEAN_ERC20, WETH } from "../../subgraph-core/utils/Constants";
import { ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadWell } from "../src/utils/Well";
import {
  ACCOUNT_ENTITY_TYPE,
  BEAN_SWAP_AMOUNT,
  BEAN_USD_AMOUNT,
  CURRENT_BLOCK_TIMESTAMP,
  DEPOSIT_ENTITY_TYPE,
  SWAP_ACCOUNT,
  WELL,
  WELL_DAILY_ENTITY_TYPE,
  WELL_ENTITY_TYPE,
  WELL_HOURLY_ENTITY_TYPE,
  WELL_LP_AMOUNT,
  WETH_SWAP_AMOUNT,
  WETH_USD_AMOUNT,
  WITHDRAW_ENTITY_TYPE
} from "./helpers/Constants";
import { boreDefaultWell } from "./helpers/Aquifer";
import {
  mockAddLiquidity,
  mockRemoveLiquidity,
  mockRemoveLiquidityOneBean,
  mockRemoveLiquidityOneWeth,
  loadWithdraw
} from "./helpers/Liquidity";
import { loadDeposit } from "./helpers/Liquidity";
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
    test("Token volumes updated", () => {});
    test("Token volumes USD updated", () => {});
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
});

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
