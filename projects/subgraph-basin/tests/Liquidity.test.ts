import { afterEach, assert, beforeEach, clearStore, describe, test } from "matchstick-as/assembly/index";
import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { BI_10, ONE_BI, subBigIntArray, ZERO_BI } from "../../subgraph-core/utils/Decimals";
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
import { initL1Version } from "./entity-mocking/MockVersion";
import { loadWell } from "../src/entities/Well";
import { calcLiquidityVolume } from "../src/utils/Volume";
import { toAddress } from "../../subgraph-core/utils/Bytes";
import { mockWellLpTokenUnderlying } from "../../subgraph-core/tests/event-mocking/Tokens";
import { deprecated_calcLiquidityVolume } from "../src/utils/legacy/CP2";
import { loadOrCreateWellFunction } from "../src/entities/WellComponents";
import { assertBDClose } from "../../subgraph-core/tests/Assert";

const BI_2 = BigInt.fromU32(2);
const BI_3 = BigInt.fromU32(3);
const BD_2 = BigDecimal.fromString("2");
const BD_3 = BigDecimal.fromString("3");

describe("Well Entity: Liquidity Event Tests", () => {
  beforeEach(() => {
    initL1Version();
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

      assertBDClose(BEAN_USD_AMOUNT, endingBalances[0]);
      assertBDClose(WETH_USD_AMOUNT, endingBalances[1]);
      assertBDClose(WETH_USD_AMOUNT.times(BigDecimal.fromString("2")), updatedStore.totalLiquidityUSD);
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.toString());
    });
    test("Zero trading volume", () => {
      let updatedStore = loadWell(WELL);
      assert.assertTrue(updatedStore.cumulativeTradeVolumeUSD.toString() == "0");
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, transferReserves[1]);
      assertBDClose(BEAN_USD_AMOUNT, transferReservesUSD[0]);
      assertBDClose(WETH_USD_AMOUNT, transferReservesUSD[1]);
    });
  });

  describe("Add Liquidity - One", () => {
    beforeEach(() => {
      mockAddLiquidity();
      mockAddLiquidity([BEAN_SWAP_AMOUNT, ZERO_BI], WELL_LP_AMOUNT, BigDecimal.fromString("0.5"));
    });
    test("Deposit counter incremented", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeDepositCount", "2");
    });
    test("Token Balances updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BI_2), endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1]);
    });
    test("Token Balances USD updated", () => {
      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reservesUSD;

      // Bean balance is still only one unit of BEAN_USD_AMOUNT because the price was cut in half on the second deposit
      assertBDClose(BEAN_USD_AMOUNT, endingBalances[0]);
      assertBDClose(WETH_USD_AMOUNT, endingBalances[1]);
      assertBDClose(BEAN_USD_AMOUNT.plus(WETH_USD_AMOUNT), updatedStore.totalLiquidityUSD);
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.times(BI_2).toString());
    });
    test("Nonzero trading volume", () => {
      let updatedStore = loadWell(WELL);
      assert.assertTrue(updatedStore.cumulativeTradeVolumeUSD.toString() != "0");
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BI_2), transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, transferReserves[1]);
      assertBDClose(BEAN_USD_AMOUNT.times(BigDecimal.fromString("1.5")), transferReservesUSD[0]);
      assertBDClose(WETH_USD_AMOUNT, transferReservesUSD[1]);
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

      assertBDClose(BEAN_USD_AMOUNT, endingBalances[0]);
      assertBDClose(WETH_USD_AMOUNT, endingBalances[1]);
      assertBDClose(WETH_USD_AMOUNT.times(BigDecimal.fromString("2")), updatedStore.totalLiquidityUSD);
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.plus(BI_10).toString());
    });
    test("Zero trading volume", () => {
      let updatedStore = loadWell(WELL);
      assert.assertTrue(updatedStore.cumulativeTradeVolumeUSD.toString() == "0");
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, transferReserves[1]);
      assertBDClose(BEAN_USD_AMOUNT, transferReservesUSD[0]);
      assertBDClose(WETH_USD_AMOUNT, transferReservesUSD[1]);
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
      assertBDClose(BEAN_USD_AMOUNT, endingBalances[0]);
      assertBDClose(WETH_USD_AMOUNT, endingBalances[1]);
      assertBDClose(BEAN_USD_AMOUNT.plus(WETH_USD_AMOUNT), updatedStore.totalLiquidityUSD);
    });
    test("Liquidity Token balance", () => {
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.plus(BI_10).toString());
    });
    test("Nonzero trading volume", () => {
      let updatedStore = loadWell(WELL);
      assert.assertTrue(updatedStore.cumulativeTradeVolumeUSD.toString() != "0");
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT.div(BI_2), transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, transferReserves[1]);
      assertBDClose(BEAN_USD_AMOUNT.div(BD_2), transferReservesUSD[0]);
      assertBDClose(WETH_USD_AMOUNT, transferReservesUSD[1]);
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
    test("Zero trading volume", () => {
      let updatedStore = loadWell(WELL);
      assert.assertTrue(updatedStore.cumulativeTradeVolumeUSD.toString() == "0");
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BI_2), transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BI_2), transferReserves[1]);
      assertBDClose(BEAN_USD_AMOUNT.times(BD_2), transferReservesUSD[0]);
      assertBDClose(WETH_USD_AMOUNT.times(BD_2), transferReservesUSD[1]);
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
    test("Nonzero trading volume", () => {
      let updatedStore = loadWell(WELL);
      assert.assertTrue(updatedStore.cumulativeTradeVolumeUSD.toString() != "0");
    });
    test("Token volumes updated", () => {
      let updatedStore = loadWell(WELL);
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BI_3), transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BI_2), transferReserves[1]);
      assertBDClose(BEAN_USD_AMOUNT.times(BD_3).truncate(2), transferReservesUSD[0]);
      assertBDClose(WETH_USD_AMOUNT.times(BD_2).truncate(2), transferReservesUSD[1]);
    });
  });

  describe("Remove Liquidity One - WETH", () => {
    beforeEach(() => {
      mockAddLiquidity();
      mockAddLiquidity();
      mockRemoveLiquidityOneWeth(WELL_LP_AMOUNT, BigDecimal.fromString("0.5"));
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
    test("Nonzero trading volume", () => {
      let updatedStore = loadWell(WELL);
      assert.assertTrue(updatedStore.cumulativeTradeVolumeUSD.toString() != "0");
    });
    test("Transfer volumes updated", () => {
      let updatedStore = loadWell(WELL);
      const transferReserves = updatedStore.cumulativeTransferVolumeReserves;
      const transferReservesUSD = updatedStore.cumulativeTransferVolumeReservesUSD;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT.times(BI_2), transferReserves[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BI_3), transferReserves[1]);
      assertBDClose(BEAN_USD_AMOUNT.times(BD_2), transferReservesUSD[0]);
      assertBDClose(WETH_USD_AMOUNT.times(BD_3), transferReservesUSD[1]);
    });
  });
  test("Liquidity Volume Calculation", () => {
    const well = loadWell(WELL);
    const wellFn = loadOrCreateWellFunction(toAddress(well.wellFunction));
    well.lpTokenSupply = ONE_BI;

    well.reserves = [BigInt.fromI32(3000).times(BI_10.pow(6)), BigInt.fromU32(1).times(BI_10.pow(18))];
    let deltaReserves = [BigInt.fromI32(1500).times(BI_10.pow(6)), ZERO_BI];
    let deltaLp = ONE_BI;
    mockWellLpTokenUnderlying(toAddress(wellFn.id), deltaLp.abs(), well.reserves, well.lpTokenSupply, well.wellFunctionData, [
      BigInt.fromString("878679656"),
      BigInt.fromString("292893218813452475")
    ]);

    let tokenTradeVolume = calcLiquidityVolume(well, deltaReserves, deltaLp);
    assert.bigIntEquals(BigInt.fromString("-621320344"), tokenTradeVolume[0]);
    assert.bigIntEquals(BigInt.fromString("292893218813452475"), tokenTradeVolume[1]);

    well.reserves = [BigInt.fromI32(1200).times(BI_10.pow(6)), BigInt.fromU32(1).times(BI_10.pow(18))];
    deltaReserves = [BigInt.fromI32(-1800).times(BI_10.pow(6)), ZERO_BI];
    deltaLp = ONE_BI.neg();
    mockWellLpTokenUnderlying(
      toAddress(wellFn.id),
      deltaLp.abs(),
      subBigIntArray(well.reserves, deltaReserves),
      well.lpTokenSupply.minus(deltaLp),
      well.wellFunctionData,
      [BigInt.fromString("697366596"), BigInt.fromString("581138830084189666")]
    );

    tokenTradeVolume = calcLiquidityVolume(well, deltaReserves, deltaLp);
    assert.bigIntEquals(BigInt.fromString("1102633404"), tokenTradeVolume[0]);
    assert.bigIntEquals(BigInt.fromString("-581138830084189666"), tokenTradeVolume[1]);
  });
  // test("Deprecated liquidity vol test", () => {
  //   const result = deprecated_calcLiquidityVolume(
  //     [BigInt.fromString('1500000000'), BigInt.fromString('9000000000000000000')],
  //     [BigInt.fromString('-1500000000'), BigInt.fromString('-1000000000000000000')]
  //   );
  //   log.info("{} {}", [result[0].toString(), result[1].toString()]);
  //
  //   const result2 = deprecated_calcLiquidityVolume(
  //     [BigInt.fromString('3000000000'), BigInt.fromString('1000000000000000000')],
  //     [BigInt.fromString('1500000000'), BigInt.fromString('0')]
  //   );
  //   log.info("{} {}", [result2[0].toString(), result2[1].toString()]);
  // });
});
