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
      let tradeAmounts = updatedStore.cumulativeTradeVolumeReserves;
      let transferAmounts = updatedStore.cumulativeTransferVolumeReserves;

      assert.bigIntEquals(ZERO_BI, tradeAmounts[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, tradeAmounts[1]);
      assert.bigIntEquals(BEAN_SWAP_AMOUNT, transferAmounts[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, transferAmounts[1]);
    });
    test("Token Volumes USD updated", () => {
      mockAddLiquidity();
      mockAddLiquidity();
      mockSwap(BigDecimal.fromString("0.5"));

      let updatedStore = loadWell(WELL);
      let tradeAmounts = updatedStore.cumulativeTradeVolumeReservesUSD;
      let transferAmounts = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.stringEquals("0", tradeAmounts[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BigDecimal.fromString("1.5")).toString(), tradeAmounts[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.times(BigDecimal.fromString("2.5")).toString(), transferAmounts[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BigDecimal.fromString("3.5")).toString(), transferAmounts[1].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BigDecimal.fromString("1.5")).toString(), updatedStore.cumulativeTradeVolumeUSD.toString());
      assert.stringEquals(
        BEAN_USD_AMOUNT.times(BigDecimal.fromString("2.5"))
          .plus(WETH_USD_AMOUNT.times(BigDecimal.fromString("3.5")))
          .toString(),
        updatedStore.cumulativeTransferVolumeUSD.toString()
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
      mockShift([BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT.times(BigInt.fromU32(3))], BEAN_ERC20, BEAN_SWAP_AMOUNT, BigDecimal.fromString("1.5"));
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
      let tradeAmounts = updatedStore.cumulativeTradeVolumeReserves;
      let transferAmounts = updatedStore.cumulativeTransferVolumeReserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, tradeAmounts[0]);
      assert.bigIntEquals(ZERO_BI, tradeAmounts[1]);
      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BigInt.fromU32(3)), transferAmounts[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BigInt.fromU32(3)), transferAmounts[1]);
    });
    test("Token Volumes USD updsted", () => {
      let updatedStore = loadWell(WELL);
      let tradeAmounts = updatedStore.cumulativeTradeVolumeReservesUSD;
      let transferAmounts = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.stringEquals(BEAN_USD_AMOUNT.times(BigDecimal.fromString("1.5")).toString(), tradeAmounts[0].toString());
      assert.stringEquals("0", tradeAmounts[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.times(BigDecimal.fromString("3.5")).toString(), transferAmounts[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BigDecimal.fromString("2.5")).toString(), transferAmounts[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.times(BigDecimal.fromString("1.5")).toString(), updatedStore.cumulativeTradeVolumeUSD.toString());
      assert.stringEquals(
        WETH_USD_AMOUNT.times(BigDecimal.fromString("2.5"))
          .plus(BEAN_USD_AMOUNT.times(BigDecimal.fromString("1.5")))
          .toString(),
        updatedStore.cumulativeTransferVolumeUSD.toString()
      );
    });
  });
});
