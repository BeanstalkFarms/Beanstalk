import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadWell } from "../src/utils/Well";
import {
  BEAN_SWAP_AMOUNT,
  BEAN_USD_AMOUNT,
  WELL,
  WELL_ENTITY_TYPE,
  WELL_LP_AMOUNT,
  WETH_SWAP_AMOUNT,
  WETH_USD_AMOUNT
} from "./helpers/Constants";
import { boreDefaultWell } from "./helpers/Aquifer";
import { mockAddLiquidity, mockRemoveLiquidity, mockRemoveLiquidityOneBean, mockRemoveLiquidityOneWeth } from "./helpers/Liquidity";
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

const BI_2 = BigInt.fromU32(2);
const BI_3 = BigInt.fromU32(3);
const BD_2 = BigDecimal.fromString("2");
const BD_3 = BigDecimal.fromString("3");

describe("Well Entity: Liquidity Event Tests", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  describe("Add Liquidity - Multiple", () => {
    beforeEach(() => {
      mockAddLiquidity();
    });
    test("Deposit counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeDepositCount", "1");
    });
    test("Token Balances updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1]);
    });
    test("Token Balances USD updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reservesUSD;

      assert.stringEquals(BEAN_USD_AMOUNT.toString(), endingBalances[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.toString(), endingBalances[1].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BigDecimal.fromString("2")).toString(), updatedStore.totalLiquidityUSD.toString());
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.toString());
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[0], BEAN_SWAP_AMOUNT);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[1], WETH_SWAP_AMOUNT);
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[0].toString(), BEAN_USD_AMOUNT.toString());
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[1].toString(), WETH_USD_AMOUNT.toString());
    });
  });

  describe("Add Liquidity - One", () => {
    // TODO
  });

  describe("Sync (Add Liquidity) - Multiple", () => {
    // TODO
  });

  describe("Sync (Add Liquidity) - One", () => {
    // TODO
  });

  describe("Remove Liquidity - Multiple", () => {
    beforeEach(() => {
      mockRemoveLiquidity();
    });
    test("Withdraw counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(ZERO_BI.minus(BEAN_SWAP_AMOUNT), endingBalances[0]);
      assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", ZERO_BI.minus(WELL_LP_AMOUNT).toString());
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[0], BEAN_SWAP_AMOUNT);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[1], WETH_SWAP_AMOUNT);
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[0].toString(), BEAN_USD_AMOUNT.toString());
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[1].toString(), WETH_USD_AMOUNT.toString());
    });
  });

  describe("Remove Liquidity One - Bean", () => {
    beforeEach(() => {
      mockAddLiquidity();
      mockAddLiquidity();
      mockRemoveLiquidityOneBean();
    });
    test("Withdraw counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BI_2), endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.toString());
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[0], BEAN_SWAP_AMOUNT.times(BI_3));
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[1], WETH_SWAP_AMOUNT.times(BI_2));
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[0].toString(), BEAN_USD_AMOUNT.times(BD_3).toString());
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[1].toString(), WETH_USD_AMOUNT.times(BD_2).toString());
    });
  });

  describe("Remove Liquidity One - WETH", () => {
    beforeEach(() => {
      mockRemoveLiquidityOneWeth();
    });
    test("Withdraw counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(ZERO_BI, endingBalances[0]);
      assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", ZERO_BI.minus(WELL_LP_AMOUNT).toString());
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[0], ZERO_BI);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[1], WETH_SWAP_AMOUNT);
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[0].toString(), "0");
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[1].toString(), WETH_USD_AMOUNT.toString());
    });
  });
});
