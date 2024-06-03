import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BI_10, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
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
import {
  mockAddLiquidity,
  mockRemoveLiquidity,
  mockRemoveLiquidityOneBean,
  mockRemoveLiquidityOneWeth,
  mockSync
} from "./helpers/Liquidity";
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { BigDecimal_max, BigDecimal_min } from "../../subgraph-core/utils/ArrayMath";

const BI_2 = BigInt.fromU32(2);
const BI_3 = BigInt.fromU32(3);
const BD_2 = BigDecimal.fromString("2");
const BD_3 = BigDecimal.fromString("3");

// Example: $10k BEAN and $20k WETH is added. Buy pressure is equivalent to $5k BEAN so the usd volume is $5k.
const liquidityEventUSDVolumeCP = (tokenUsd: BigDecimal[]): BigDecimal => {
  const difference = BigDecimal_max(tokenUsd).minus(BigDecimal_min(tokenUsd));
  return difference.div(BigDecimal.fromString("2"));
};

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
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      const volumeUsd = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, WETH_USD_AMOUNT]);
      assert.stringEquals(updatedStore.cumulativeVolumeUSD.toString(), volumeUsd.toString());
    });
  });

  describe("Add Liquidity - One", () => {
    beforeEach(() => {
      mockAddLiquidity([BEAN_SWAP_AMOUNT, ZERO_BI]);
    });
    test("Deposit counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeDepositCount", "1");
    });
    test("Token Balances updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(ZERO_BI, endingBalances[1]);
    });
    test("Token Balances USD updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reservesUSD;

      assert.stringEquals(BEAN_USD_AMOUNT.toString(), endingBalances[0].toString());
      assert.stringEquals("0", endingBalances[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.toString(), updatedStore.totalLiquidityUSD.toString());
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.toString());
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[0], BEAN_SWAP_AMOUNT);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[1], ZERO_BI);
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[0].toString(), BEAN_USD_AMOUNT.toString());
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[1].toString(), "0");
    });
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      const volumeUsd = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, ZERO_BD]);
      assert.stringEquals(updatedStore.cumulativeVolumeUSD.toString(), volumeUsd.toString());
    });
  });

  describe("Sync (Add Liquidity) - Multiple", () => {
    beforeEach(() => {
      mockAddLiquidity([BEAN_SWAP_AMOUNT.div(BI_2), WETH_SWAP_AMOUNT.div(BI_2)]);
      mockSync([BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT], BI_10);
    });
    test("Deposit counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeDepositCount", "2");
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
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.plus(BI_10).toString());
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[0], BEAN_SWAP_AMOUNT);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[1], WETH_SWAP_AMOUNT);
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[0].toString(), BEAN_USD_AMOUNT.toString());
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[1].toString(), WETH_USD_AMOUNT.toString());
    });
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      let volumeUsd = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT.div(BD_2), WETH_USD_AMOUNT.div(BD_2)]);
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT.div(BD_2), WETH_USD_AMOUNT.div(BD_2)]));
      assert.stringEquals(updatedStore.cumulativeVolumeUSD.toString(), volumeUsd.toString());
    });
  });

  describe("Sync (Add Liquidity) - One", () => {
    beforeEach(() => {
      mockAddLiquidity([BEAN_SWAP_AMOUNT.div(BI_2), WETH_SWAP_AMOUNT.div(BI_2)]);
      mockSync([BEAN_SWAP_AMOUNT.div(BI_2), WETH_SWAP_AMOUNT], BI_10);
    });
    test("Deposit counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeDepositCount", "2");
    });
    test("Token Balances updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT.div(BI_2), endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1]);
    });
    test("Token Balances USD updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reservesUSD;

      assert.stringEquals(BEAN_USD_AMOUNT.div(BD_2).toString(), endingBalances[0].toString(), "BEAN");
      assert.stringEquals(WETH_USD_AMOUNT.toString(), endingBalances[1].toString(), "WETH");
      assert.stringEquals(
        BEAN_USD_AMOUNT.div(BD_2).plus(WETH_USD_AMOUNT).toString(),
        updatedStore.totalLiquidityUSD.toString(),
        "Liquidity"
      );
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.plus(BI_10).toString());
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[0], BEAN_SWAP_AMOUNT.div(BI_2));
      assert.bigIntEquals(updatedStore.cumulativeVolumeReserves[1], WETH_SWAP_AMOUNT);
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[0].toString(), BEAN_USD_AMOUNT.div(BD_2).toString());
      assert.stringEquals(updatedStore.cumulativeVolumeReservesUSD[1].toString(), WETH_USD_AMOUNT.toString());
    });
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      let volumeUsd = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT.div(BD_2), WETH_USD_AMOUNT.div(BD_2)]);
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([ZERO_BD, WETH_USD_AMOUNT.div(BD_2)]));
      assert.stringEquals(updatedStore.cumulativeVolumeUSD.toString(), volumeUsd.toString());
    });
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
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      const volumeUsd = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, WETH_USD_AMOUNT]);
      assert.stringEquals(updatedStore.cumulativeVolumeUSD.toString(), volumeUsd.toString());
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
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      let volumeUsd = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, WETH_USD_AMOUNT]);
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, WETH_USD_AMOUNT]));
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, ZERO_BD]));
      assert.stringEquals(updatedStore.cumulativeVolumeUSD.toString(), volumeUsd.toString());
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
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      const volumeUsd = liquidityEventUSDVolumeCP([ZERO_BD, WETH_USD_AMOUNT]);
      assert.stringEquals(updatedStore.cumulativeVolumeUSD.toString(), volumeUsd.toString());
    });
  });
});
