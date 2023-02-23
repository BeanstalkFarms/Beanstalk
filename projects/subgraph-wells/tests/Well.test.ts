import { afterEach, assert, beforeEach, clearStore, describe, logStore, test } from "matchstick-as/assembly/index";
import { BEAN_ERC20, WETH } from "../src/utils/Constants";
import { ZERO_BD, ZERO_BI } from "../src/utils/Decimals";
import { loadWell } from "../src/utils/Well";
import {
  ACCOUNT_ENTITY_TYPE,
  BEAN_SWAP_AMOUNT,
  BEAN_USD_AMOUNT,
  CURRENT_BLOCK_TIMESTAMP,
  DEPOSIT_ENTITY_TYPE,
  SWAP_ACCOUNT,
  SWAP_ENTITY_TYPE,
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
import { createDefaultSwap } from "./helpers/Swap";
import {
  createDefaultAddLiquidity,
  createDefaultRemoveLiquidity,
  createRemoveLiquidityOneBean,
  createRemoveLiquidityOneWeth,
  loadWithdraw
} from "./helpers/Liquidity";
import { loadDeposit } from "./helpers/Liquidity";
import { dayFromTimestamp, hourFromTimestamp } from "../src/utils/Dates";
import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";

describe("Well Entity: Single Event Tests", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  describe("Add Liquidity", () => {
    test("Deposit counter incremented", () => {
      createDefaultAddLiquidity();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeDepositCount", "1");
    });
    test("Token Balances updated", () => {
      createDefaultAddLiquidity();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT, endingBalances[1]);
    });
    test("Token Balances USD updated", () => {
      createDefaultAddLiquidity();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reservesUSD;

      assert.stringEquals(BEAN_USD_AMOUNT.toString(), endingBalances[0].toString());
      assert.stringEquals(WETH_USD_AMOUNT.toString(), endingBalances[1].toString());
      assert.stringEquals(WETH_USD_AMOUNT.times(BigDecimal.fromString("2")).toString(), updatedStore.totalLiquidityUSD.toString());
    });
    test("Liquidity Token balance", () => {
      createDefaultAddLiquidity();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.toString());
    });
    test("Previous day snapshot entity created", () => {
      createDefaultAddLiquidity();

      let dayID = dayFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let daySnapshotID = WELL.concatI32(dayID);

      let hourID = hourFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let hourSnapshotID = WELL.concatI32(hourID);

      assert.fieldEquals(WELL_DAILY_ENTITY_TYPE, daySnapshotID.toHexString(), "id", daySnapshotID.toHexString());
      assert.fieldEquals(WELL_HOURLY_ENTITY_TYPE, hourSnapshotID.toHexString(), "id", hourSnapshotID.toHexString());
    });
  });

  describe("Remove Liquidity", () => {
    test("Withdraw counter incremented", () => {
      createDefaultRemoveLiquidity();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      createDefaultRemoveLiquidity();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(ZERO_BI.minus(BEAN_SWAP_AMOUNT), endingBalances[0]);
      assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      createDefaultRemoveLiquidity();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", ZERO_BI.minus(WELL_LP_AMOUNT).toString());
    });
    test("Previous day snapshot entity created", () => {
      createDefaultAddLiquidity();

      let dayID = dayFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let daySnapshotID = WELL.concatI32(dayID);

      let hourID = hourFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let hourSnapshotID = WELL.concatI32(hourID);

      assert.fieldEquals(WELL_DAILY_ENTITY_TYPE, daySnapshotID.toHexString(), "id", daySnapshotID.toHexString());
      assert.fieldEquals(WELL_HOURLY_ENTITY_TYPE, hourSnapshotID.toHexString(), "id", hourSnapshotID.toHexString());
    });
  });

  describe("Remove Liquidity One - Bean", () => {
    test("Withdraw counter incremented", () => {
      createDefaultAddLiquidity();
      createDefaultAddLiquidity();
      createRemoveLiquidityOneBean();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      createDefaultAddLiquidity();
      createDefaultAddLiquidity();
      createRemoveLiquidityOneBean();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(BEAN_SWAP_AMOUNT, endingBalances[0]);
      assert.bigIntEquals(WETH_SWAP_AMOUNT.times(BigInt.fromI32(2)), endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      createDefaultAddLiquidity();
      createDefaultAddLiquidity();
      createRemoveLiquidityOneBean();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", WELL_LP_AMOUNT.toString());
    });
    test("Previous day snapshot entity created", () => {
      createDefaultAddLiquidity();

      let dayID = dayFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let daySnapshotID = WELL.concatI32(dayID);

      let hourID = hourFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let hourSnapshotID = WELL.concatI32(hourID);

      assert.fieldEquals(WELL_DAILY_ENTITY_TYPE, daySnapshotID.toHexString(), "id", daySnapshotID.toHexString());
      assert.fieldEquals(WELL_HOURLY_ENTITY_TYPE, hourSnapshotID.toHexString(), "id", hourSnapshotID.toHexString());
    });
  });

  describe("Remove Liquidity One - WETH", () => {
    test("Withdraw counter incremented", () => {
      createRemoveLiquidityOneWeth();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "cumulativeWithdrawCount", "1");
    });
    test("Token Balances updated", () => {
      createRemoveLiquidityOneWeth();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.reserves;

      assert.bigIntEquals(ZERO_BI, endingBalances[0]);
      assert.bigIntEquals(ZERO_BI.minus(WETH_SWAP_AMOUNT), endingBalances[1]);
    });
    test("Liquidity Token balance", () => {
      createRemoveLiquidityOneWeth();
      assert.fieldEquals(WELL_ENTITY_TYPE, WELL.toHexString(), "lpTokenSupply", ZERO_BI.minus(WELL_LP_AMOUNT).toString());
    });
    test("Previous day snapshot entity created", () => {
      createDefaultAddLiquidity();

      let dayID = dayFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let daySnapshotID = WELL.concatI32(dayID);

      let hourID = hourFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let hourSnapshotID = WELL.concatI32(hourID);

      assert.fieldEquals(WELL_DAILY_ENTITY_TYPE, daySnapshotID.toHexString(), "id", daySnapshotID.toHexString());
      assert.fieldEquals(WELL_HOURLY_ENTITY_TYPE, hourSnapshotID.toHexString(), "id", hourSnapshotID.toHexString());
    });
  });

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
      assert.bigIntEquals(ZERO_BI, endingBalances[1]);
    });

    test("Token Volumes USD updated", () => {
      createDefaultAddLiquidity();
      createDefaultAddLiquidity();
      createDefaultSwap();

      let updatedStore = loadWell(WELL);
      let endingBalances = updatedStore.cumulativeVolumeReservesUSD;

      assert.stringEquals(BEAN_USD_AMOUNT.toString(), endingBalances[0].toString());
      assert.stringEquals(ZERO_BD.toString(), endingBalances[1].toString());
      assert.stringEquals(BEAN_USD_AMOUNT.toString(), updatedStore.cumulativeVolumeUSD.toString());
    });

    test("Previous day snapshot entity created", () => {
      createDefaultAddLiquidity();

      let dayID = dayFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let daySnapshotID = WELL.concatI32(dayID);

      let hourID = hourFromTimestamp(CURRENT_BLOCK_TIMESTAMP) - 1;
      let hourSnapshotID = WELL.concatI32(hourID);

      assert.fieldEquals(WELL_DAILY_ENTITY_TYPE, daySnapshotID.toHexString(), "id", daySnapshotID.toHexString());
      assert.fieldEquals(WELL_HOURLY_ENTITY_TYPE, hourSnapshotID.toHexString(), "id", hourSnapshotID.toHexString());
    });
  });
});

describe("Swap Entity", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  test("Swap entity exists", () => {
    let id = createDefaultSwap();
    assert.fieldEquals(SWAP_ENTITY_TYPE, id, "id", id);
  });
  test("Account entity exists", () => {
    let id = createDefaultSwap();
    assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
  });
  test("Well value", () => {
    let id = createDefaultSwap();
    assert.fieldEquals(SWAP_ENTITY_TYPE, id, "well", WELL.toHexString());
  });
  test("fromToken value", () => {
    let id = createDefaultSwap();
    assert.fieldEquals(SWAP_ENTITY_TYPE, id, "fromToken", BEAN_ERC20.toHexString());
  });
  test("amountIn value", () => {
    let id = createDefaultSwap();
    assert.fieldEquals(SWAP_ENTITY_TYPE, id, "amountIn", BEAN_SWAP_AMOUNT.toString());
  });
  test("toToken value", () => {
    let id = createDefaultSwap();
    assert.fieldEquals(SWAP_ENTITY_TYPE, id, "toToken", WETH.toHexString());
  });
  test("amountOut value", () => {
    let id = createDefaultSwap();
    assert.fieldEquals(SWAP_ENTITY_TYPE, id, "amountOut", WETH_SWAP_AMOUNT.toString());
  });
});

describe("AddLiquidity => Deposit Entity", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  test("Deposit entity exists", () => {
    let id = createDefaultAddLiquidity();
    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "id", id);
  });
  test("Account entity exists", () => {
    let id = createDefaultAddLiquidity();
    assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
  });
  test("Well value", () => {
    let id = createDefaultAddLiquidity();
    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "well", WELL.toHexString());
  });
  test("lpAmountOut => liquidity value", () => {
    let id = createDefaultAddLiquidity();
    assert.fieldEquals(DEPOSIT_ENTITY_TYPE, id, "liquidity", WELL_LP_AMOUNT.toString());
  });
  test("inputTokens value", () => {
    let id = createDefaultAddLiquidity();

    let updatedStore = loadDeposit(id);
    let tokens = updatedStore.tokens;

    assert.bytesEquals(BEAN_ERC20, tokens[0]);
    assert.bytesEquals(WETH, tokens[1]);
  });
  test("inputTokenAmounts value", () => {
    let id = createDefaultAddLiquidity();

    let updatedStore = loadDeposit(id);
    let reserves = updatedStore.reserves;

    assert.bigIntEquals(BEAN_SWAP_AMOUNT, reserves[0]);
    assert.bigIntEquals(WETH_SWAP_AMOUNT, reserves[1]);
  });
});

describe("RemoveLiquidity => Withdraw Entity", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  test("Withdraw entity exists", () => {
    let id = createDefaultRemoveLiquidity();
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "id", id);
  });
  test("Account entity exists", () => {
    let id = createDefaultRemoveLiquidity();
    assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
  });
  test("Well value", () => {
    let id = createDefaultRemoveLiquidity();
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "well", WELL.toHexString());
  });
  test("lpAmountIn => liquidity value", () => {
    let id = createDefaultRemoveLiquidity();
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "liquidity", WELL_LP_AMOUNT.toString());
  });
  test("inputTokens value", () => {
    let id = createDefaultRemoveLiquidity();

    let updatedStore = loadWithdraw(id);
    let tokens = updatedStore.tokens;

    assert.bytesEquals(BEAN_ERC20, tokens[0]);
    assert.bytesEquals(WETH, tokens[1]);
  });
  test("inputTokenAmounts value", () => {
    let id = createDefaultRemoveLiquidity();

    let updatedStore = loadWithdraw(id);
    let reserves = updatedStore.reserves;

    assert.bigIntEquals(BEAN_SWAP_AMOUNT, reserves[0]);
    assert.bigIntEquals(WETH_SWAP_AMOUNT, reserves[1]);
  });
});

describe("RemoveLiquidityOneToken => Withdraw Entity", () => {
  beforeEach(() => {
    boreDefaultWell();
  });

  afterEach(() => {
    clearStore();
  });

  test("Withdraw entity exists", () => {
    createDefaultAddLiquidity();
    createDefaultAddLiquidity();
    let id = createRemoveLiquidityOneBean();
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "id", id);
  });
  test("Account entity exists", () => {
    createDefaultAddLiquidity();
    createDefaultAddLiquidity();
    let id = createRemoveLiquidityOneBean();
    assert.fieldEquals(ACCOUNT_ENTITY_TYPE, SWAP_ACCOUNT.toHexString(), "id", SWAP_ACCOUNT.toHexString());
  });
  test("Well value", () => {
    createDefaultAddLiquidity();
    createDefaultAddLiquidity();
    let id = createRemoveLiquidityOneBean();
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "well", WELL.toHexString());
  });
  test("lpAmountIn => liquidity value", () => {
    createDefaultAddLiquidity();
    createDefaultAddLiquidity();
    let id = createRemoveLiquidityOneBean();
    assert.fieldEquals(WITHDRAW_ENTITY_TYPE, id, "liquidity", WELL_LP_AMOUNT.toString());
  });
  test("inputTokens value", () => {
    createDefaultAddLiquidity();
    createDefaultAddLiquidity();
    let id = createRemoveLiquidityOneBean();

    let updatedStore = loadWithdraw(id);
    let tokens = updatedStore.tokens;

    assert.bytesEquals(BEAN_ERC20, tokens[0]);
    assert.bytesEquals(WETH, tokens[1]);
  });
  test("inputTokenAmounts value", () => {
    createDefaultAddLiquidity();
    createDefaultAddLiquidity();
    let id = createRemoveLiquidityOneBean();

    let updatedStore = loadWithdraw(id);
    let reserves = updatedStore.reserves;

    assert.bigIntEquals(BEAN_SWAP_AMOUNT, reserves[0]);
    assert.bigIntEquals(ZERO_BI, reserves[1]);
  });
});
