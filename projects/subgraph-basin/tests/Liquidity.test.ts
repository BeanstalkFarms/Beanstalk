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
const BI_4 = BigInt.fromU32(4);
const BD_2 = BigDecimal.fromString("2");
const BD_3 = BigDecimal.fromString("3");
const BD_4 = BigDecimal.fromString("4");

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
      const tradeReserves = updatedStore.cumulativeTradeVolumeReserves;
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const tradeReservesUSD = updatedStore.cumulativeTradeVolumeReservesUSD;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(ZERO_BI, tradeReserves[0]);
      assert.bigIntEquals(ZERO_BI, tradeReserves[1]);
      assert.bigIntEquals(BEAN_SWAP_AMOUNT, transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, transferReserves[1]);
      assert.stringEquals("0", tradeReservesUSD[0].toString());
      assert.stringEquals("0", tradeReservesUSD[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.toString(), transferReservesUSD[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.toString(), transferReservesUSD[1].toString());
    });
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      const tradeVolumeUSD = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, WETH_USD_AMOUNT]);
      assert.stringEquals(tradeVolumeUSD.toString(), updatedStore.cumulativeTradeVolumeUSD.toString());
      assert.stringEquals(BEAN_USD_AMOUNT.plus(WETH_USD_AMOUNT).toString(), updatedStore.cumulativeTransferVolumeUSD.toString());
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
      const tradeReserves = updatedStore.cumulativeTradeVolumeReserves;
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const tradeReservesUSD = updatedStore.cumulativeTradeVolumeReservesUSD;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT.div(BI_2), tradeReserves[0]);
      assert.bigIntEquals(ZERO_BI, tradeReserves[1]);
      assert.bigIntEquals(BEAN_SWAP_AMOUNT, transferReserves[0]);
      assert.bigIntEquals(ZERO_BI, transferReserves[1]);
      assert.stringEquals(BEAN_USD_AMOUNT.div(BD_2).toString(), tradeReservesUSD[0].toString());
      assert.stringEquals("0", tradeReservesUSD[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.toString(), transferReservesUSD[0].toString());
      assert.stringEquals("0", transferReservesUSD[1].toString());
    });
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      const volumeUsd = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, ZERO_BD]);
      assert.stringEquals(volumeUsd.toString(), updatedStore.cumulativeTradeVolumeUSD.toString());
      assert.stringEquals(BEAN_USD_AMOUNT.toString(), updatedStore.cumulativeTransferVolumeUSD.toString());
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
      const tradeReserves = updatedStore.cumulativeTradeVolumeReserves;
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const tradeReservesUSD = updatedStore.cumulativeTradeVolumeReservesUSD;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(ZERO_BI, tradeReserves[0]);
      assert.bigIntEquals(ZERO_BI, tradeReserves[1]);
      assert.bigIntEquals(BEAN_SWAP_AMOUNT, transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, transferReserves[1]);
      assert.stringEquals("0", tradeReservesUSD[0].toString());
      assert.stringEquals("0", tradeReservesUSD[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.toString(), transferReservesUSD[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.toString(), transferReservesUSD[1].toString());
    });
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      let volumeUsd = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT.div(BD_2), WETH_USD_AMOUNT.div(BD_2)]);
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT.div(BD_2), WETH_USD_AMOUNT.div(BD_2)]));
      assert.stringEquals(volumeUsd.toString(), updatedStore.cumulativeTradeVolumeUSD.toString());
      assert.stringEquals(BEAN_USD_AMOUNT.plus(WETH_USD_AMOUNT).toString(), updatedStore.cumulativeTransferVolumeUSD.toString());
    });
  });

  describe("Sync (Add Liquidity) - One", () => {
    beforeEach(() => {
      mockAddLiquidity([BEAN_SWAP_AMOUNT.div(BI_2), WETH_SWAP_AMOUNT.div(BI_2)]);
      // WETH is doubled so the bean price is also doubled
      mockSync([BEAN_SWAP_AMOUNT.div(BI_2), WETH_SWAP_AMOUNT], BI_10, BigDecimal.fromString("2"));
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

      // WETH was doubled from the initial, so the bean price has also doubled
      assert.stringEquals(BEAN_USD_AMOUNT.toString(), endingBalances[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.toString(), endingBalances[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.plus(WETH_USD_AMOUNT).toString(), updatedStore.totalLiquidityUSD.toString());
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.plus(BI_10).toString());
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      const tradeReserves = updatedStore.cumulativeTradeVolumeReserves;
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const tradeReservesUSD = updatedStore.cumulativeTradeVolumeReservesUSD;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(ZERO_BI, tradeReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.div(BI_4), tradeReserves[1]);
      assert.bigIntEquals(BEAN_SWAP_AMOUNT.div(BI_2), transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, transferReserves[1]);
      assert.stringEquals("0", tradeReservesUSD[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.div(BD_4).toString(), tradeReservesUSD[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.div(BD_2).toString(), transferReservesUSD[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.toString(), transferReservesUSD[1].toString());
    });
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      let volumeUsd = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT.div(BD_2), WETH_USD_AMOUNT.div(BD_2)]);
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([ZERO_BD, WETH_USD_AMOUNT.div(BD_2)]));
      assert.stringEquals(volumeUsd.toString(), updatedStore.cumulativeTradeVolumeUSD.toString());
      assert.stringEquals(BEAN_USD_AMOUNT.div(BD_2).plus(WETH_USD_AMOUNT).toString(), updatedStore.cumulativeTransferVolumeUSD.toString());
    });
  });

  describe("Remove Liquidity - Multiple", () => {
    beforeEach(() => {
      mockAddLiquidity();
      mockRemoveLiquidity();
    });
    test("Withdraw counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(ZERO_BI, endingBalances[0]);
      assert.bigIntEquals(ZERO_BI, endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", "0");
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      const tradeReserves = updatedStore.cumulativeTradeVolumeReserves;
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const tradeReservesUSD = updatedStore.cumulativeTradeVolumeReservesUSD;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(ZERO_BI, tradeReserves[0]);
      assert.bigIntEquals(ZERO_BI, tradeReserves[1]);
      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BI_2), transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BI_2), transferReserves[1]);
      assert.stringEquals("0", tradeReservesUSD[0].toString());
      assert.stringEquals("0", tradeReservesUSD[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.times(BD_2).toString(), transferReservesUSD[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BD_2).toString(), transferReservesUSD[1].toString());
    });
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      let volumeUsd = liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, WETH_USD_AMOUNT]);
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, WETH_USD_AMOUNT]));
      assert.stringEquals(volumeUsd.toString(), updatedStore.cumulativeTradeVolumeUSD.toString());
      assert.stringEquals(
        BEAN_USD_AMOUNT.times(BD_2).plus(WETH_USD_AMOUNT.times(BD_2)).toString(),
        updatedStore.cumulativeTransferVolumeUSD.toString()
      );
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
      const tradeReserves = updatedStore.cumulativeTradeVolumeReserves;
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const tradeReservesUSD = updatedStore.cumulativeTradeVolumeReservesUSD;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(ZERO_BI, tradeReserves[0]);
      // FIXME: this might not be /2
      assert.bigIntEquals(WETH_SWAP_AMOUNT.div(BI_2), tradeReserves[1]);
      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BI_3), transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BI_2), transferReserves[1]);
      assert.stringEquals("0", tradeReservesUSD[0].toString());
      // FIXME: this might not be /2
      assert.stringEquals(WETH_USD_AMOUNT.div(BD_2).toString(), tradeReservesUSD[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.times(BD_3).toString(), transferReservesUSD[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BD_2).toString(), transferReservesUSD[1].toString());
    });
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      let volumeUsd = liquidityEventUSDVolumeCP([WETH_USD_AMOUNT, BEAN_USD_AMOUNT]);
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([WETH_USD_AMOUNT, BEAN_USD_AMOUNT]));
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([BEAN_USD_AMOUNT, ZERO_BD]));
      assert.stringEquals(volumeUsd.toString(), updatedStore.cumulativeTradeVolumeUSD.toString());
      assert.stringEquals(
        WETH_USD_AMOUNT.times(BD_2).plus(BEAN_USD_AMOUNT.times(BD_3)).toString(),
        updatedStore.cumulativeTransferVolumeUSD.toString()
      );
    });
  });

  describe("Remove Liquidity One - WETH", () => {
    beforeEach(() => {
      mockAddLiquidity();
      mockAddLiquidity();
      mockRemoveLiquidityOneWeth(BigDecimal.fromString("0.5"));
    });
    test("Withdraw counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BI_2), endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.toString());
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      const tradeReserves = updatedStore.cumulativeTradeVolumeReserves;
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const tradeReservesUSD = updatedStore.cumulativeTradeVolumeReservesUSD;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      // FIXME: this might not be /2
      assert.bigIntEquals(BEAN_SWAP_AMOUNT.div(BI_2), tradeReserves[0]);
      assert.bigIntEquals(ZERO_BI, tradeReserves[1]);
      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BI_2), transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BI_3), transferReserves[1]);
      // FIXME: this might not be /2
      assert.stringEquals(WETH_USD_AMOUNT.div(BD_2).toString(), tradeReservesUSD[0].toString());
      assert.stringEquals("0", tradeReservesUSD[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.times(BD_2).toString(), transferReservesUSD[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BD_3).toString(), transferReservesUSD[1].toString());
    });
    test("Cumulative volume updated (CP)", () => {
      let updatedStore = loadWell(WELL);
      let volumeUsd = liquidityEventUSDVolumeCP([WETH_USD_AMOUNT, BEAN_USD_AMOUNT]);
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([WETH_USD_AMOUNT, BEAN_USD_AMOUNT]));
      volumeUsd = volumeUsd.plus(liquidityEventUSDVolumeCP([ZERO_BD, WETH_USD_AMOUNT]));
      assert.stringEquals(volumeUsd.toString(), updatedStore.cumulativeTradeVolumeUSD.toString());
      assert.stringEquals(
        WETH_USD_AMOUNT.times(BD_3).plus(BEAN_USD_AMOUNT.times(BD_2)).toString(),
        updatedStore.cumulativeTransferVolumeUSD.toString()
      );
    });
  });
});
