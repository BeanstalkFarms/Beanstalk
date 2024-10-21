import { BigInt } from "@graphprotocol/graph-ts";
import { afterEach, beforeEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import {
  BEAN_3CRV,
  BEAN_ERC20,
  BEAN_WETH_CP2_WELL,
  BEANSTALK,
  GAUGE_BIP45_BLOCK,
  LUSD_3POOL,
  UNRIPE_BEAN,
  UNRIPE_LP
} from "../../subgraph-core/constants/raw/BeanstalkEthConstants";
import {
  createAddDepositV2Event,
  createAddDepositV3Event,
  createRemoveDepositsV2Event,
  createRemoveDepositV2Event,
  createRemoveDepositV3Event
} from "./event-mocking/Silo";
import { createDewhitelistTokenEvent, createWhitelistTokenV2Event, createWhitelistTokenV3Event } from "./event-mocking/Whitelist";
import { ONE_BI, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { dayFromTimestamp } from "../../subgraph-core/utils/Dates";
import { setSeason } from "./utils/Season";
import {
  handleAddDeposit_v2,
  handleRemoveDeposit_v2,
  handleRemoveDeposits_v2,
  handleWhitelistToken_v2,
  handleWhitelistToken_v3
} from "../src/handlers/legacy/LegacySiloHandler";
import { handleAddDeposit, handleDewhitelistToken, handleRemoveDeposit } from "../src/handlers/SiloHandler";
import { initL1Version } from "./entity-mocking/MockVersion";
import { stemFromSeason } from "../src/utils/legacy/LegacySilo";

describe("Silo Events", () => {
  beforeEach(() => {
    initL1Version();
  });
  afterEach(() => {
    clearStore();
  });

  describe("Deposit/Withdraw", () => {
    test("AddDeposit - Silo v2", () => {
      let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
      let token = BEAN_ERC20.toHexString().toLowerCase();

      let newAddDepositEvent = createAddDepositV2Event(account, token, 6100, 1000, 6, 1000);
      handleAddDeposit_v2(newAddDepositEvent);

      assert.fieldEquals("Silo", account, "depositedBDV", "1000000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "season", "6100");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "depositVersion", "season");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "stem", "null");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "stemV31", "-16220000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "depositedAmount", "1000000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "1000000000");
    });

    test("AddDeposit - Silo v3", () => {
      let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
      let token = BEAN_ERC20.toHexString().toLowerCase();

      let newAddDepositEvent = createAddDepositV3Event(account, token, BigInt.fromU32(1500), 1000, 6, 1000);
      handleAddDeposit(newAddDepositEvent);

      assert.fieldEquals("Silo", account, "depositedBDV", "1000000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-1500", "stem", "1500");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-1500", "depositVersion", "v3");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-1500", "stemV31", "1500000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-1500", "depositedAmount", "1000000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "1000000000");

      // with V3.1 stem
      let addDeposit31 = createAddDepositV3Event(account, token, BigInt.fromI64(5700000000), 2500, 6, 2500);
      addDeposit31.block = mockBlock(GAUGE_BIP45_BLOCK.plus(ONE_BI));
      handleAddDeposit(addDeposit31);

      assert.fieldEquals("Silo", account, "depositedBDV", "3500000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-5700000000", "stem", "5700000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-5700000000", "depositVersion", "v3.1");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-5700000000", "stemV31", "5700000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-5700000000", "depositedAmount", "2500000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "3500000000");
    });

    test("RemoveDeposit - 80% removed", () => {
      let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
      let token = BEAN_ERC20.toHexString().toLowerCase();

      let newAddDepositEvent = createAddDepositV2Event(account, token, 6100, 1000, 6, 1000);
      handleAddDeposit_v2(newAddDepositEvent);

      let newRemoveDepositEvent = createRemoveDepositV2Event(account, token, 6100, BigInt.fromString("800000000"));
      handleRemoveDeposit_v2(newRemoveDepositEvent);

      assert.fieldEquals("Silo", account, "depositedBDV", "200000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "depositedAmount", "200000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "depositedBDV", "200000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "200000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedAmount", "200000000");
    });

    test("RemoveDeposit - Multiple removals", () => {
      let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
      let token = BEAN_ERC20.toHexString().toLowerCase();

      let newAddDepositEvent = createAddDepositV2Event(account, token, 6100, 1000, 6, 1000);
      handleAddDeposit_v2(newAddDepositEvent);

      let removeEvent = createRemoveDepositV2Event(account, token, 6100, BigInt.fromString("500000000"));
      handleRemoveDeposit_v2(removeEvent);

      let removeEvent2 = createRemoveDepositV2Event(account, token, 6100, BigInt.fromString("200000000"));
      handleRemoveDeposit_v2(removeEvent2);

      assert.fieldEquals("Silo", account, "depositedBDV", "300000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "depositedAmount", "300000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "depositedBDV", "300000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "300000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedAmount", "300000000");

      // Remove the deposit completely
      let removeEvent3 = createRemoveDepositV2Event(account, token, 6100, BigInt.fromString("300000000"));
      handleRemoveDeposit_v2(removeEvent3);

      assert.fieldEquals("Silo", account, "depositedBDV", "0");
      assert.notInStore("SiloDeposit", account + "-" + token + "-season-6100");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "0");
    });

    test("Adding/Removing multiple tokens/types - Silo/Asset balance totals", () => {
      let account1 = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
      let account2 = "0x1234567890abcdef1234567890abcdef12345679".toLowerCase();
      let token1 = BEAN_ERC20.toHexString().toLowerCase();
      let token2 = BEAN_3CRV.toHexString().toLowerCase();

      let addV2_1 = createAddDepositV2Event(account1, token1, 6100, 1000, 6, 1000);
      handleAddDeposit_v2(addV2_1);
      let addV3_1 = createAddDepositV3Event(account1, token1, BigInt.fromU32(70), 2000, 6, 2000);
      handleAddDeposit(addV3_1);
      let addV3_2 = createAddDepositV3Event(account1, token2, BigInt.fromU32(50), 1000, 6, 1000);
      handleAddDeposit(addV3_2);
      let addV3_3 = createAddDepositV3Event(account2, token2, BigInt.fromU32(90), 5000, 6, 4000);
      handleAddDeposit(addV3_3);

      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "depositedBDV", "8000000000");
      assert.fieldEquals("Silo", account1, "depositedBDV", "4000000000");
      assert.fieldEquals("Silo", account2, "depositedBDV", "4000000000");
      assert.fieldEquals("SiloAsset", BEANSTALK.toHexString() + "-" + token1, "depositedBDV", "3000000000");
      assert.fieldEquals("SiloAsset", BEANSTALK.toHexString() + "-" + token2, "depositedBDV", "5000000000");
      assert.fieldEquals("SiloAsset", account1 + "-" + token1, "depositedBDV", "3000000000");
      assert.fieldEquals("SiloAsset", account1 + "-" + token2, "depositedBDV", "1000000000");
      assert.fieldEquals("SiloAsset", account2 + "-" + token2, "depositedBDV", "4000000000");

      let removeV2_1 = createRemoveDepositsV2Event(account1, token1, [6100], [BigInt.fromU32(1000000000)], BigInt.fromU32(1000000000));
      handleRemoveDeposits_v2(removeV2_1);
      let removeV3_1 = createRemoveDepositV3Event(
        account2,
        token2,
        BigInt.fromU32(90),
        BigInt.fromU32(1500000000),
        BigInt.fromU32(1500000000)
      );
      handleRemoveDeposit(removeV3_1);

      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "depositedBDV", "5500000000");
      assert.fieldEquals("Silo", account1, "depositedBDV", "3000000000");
      assert.fieldEquals("Silo", account2, "depositedBDV", "2500000000");
      assert.fieldEquals("SiloAsset", BEANSTALK.toHexString() + "-" + token1, "depositedBDV", "2000000000");
      assert.fieldEquals("SiloAsset", BEANSTALK.toHexString() + "-" + token2, "depositedBDV", "3500000000");
      assert.fieldEquals("SiloAsset", account1 + "-" + token1, "depositedBDV", "2000000000");
      assert.fieldEquals("SiloAsset", account1 + "-" + token2, "depositedBDV", "1000000000");
      assert.fieldEquals("SiloAsset", account2 + "-" + token2, "depositedBDV", "2500000000");
    });

    // It is assumed sufficient to test a few fields updating properly
    test("Hourly/Daily snapshots update appropriately", () => {
      const baseTimestamp = BigInt.fromU32(1712732400);
      const hours15 = BigInt.fromU64(15 * 60 * 60);
      let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
      let token = BEAN_ERC20.toHexString().toLowerCase();

      let addV3_1 = createAddDepositV3Event(account, token, BigInt.fromU32(70), 2000, 6, 2000);
      addV3_1.block = mockBlock(ZERO_BI, baseTimestamp);
      setSeason(20000);
      handleAddDeposit(addV3_1);

      assert.fieldEquals("SiloHourlySnapshot", account + "-20000", "depositedBDV", "2000000000");
      assert.fieldEquals("SiloHourlySnapshot", account + "-20000", "deltaDepositedBDV", "2000000000");
      assert.fieldEquals(
        "SiloDailySnapshot",
        account + "-" + dayFromTimestamp(addV3_1.block.timestamp).toString(),
        "depositedBDV",
        "2000000000"
      );
      assert.fieldEquals(
        "SiloDailySnapshot",
        account + "-" + dayFromTimestamp(addV3_1.block.timestamp).toString(),
        "deltaDepositedBDV",
        "2000000000"
      );

      let addV3_2 = createAddDepositV3Event(account, token, BigInt.fromU32(50), 1000, 6, 1000);
      addV3_2.block = mockBlock(ZERO_BI, baseTimestamp.plus(hours15));
      setSeason(20015);
      handleAddDeposit(addV3_2);

      assert.fieldEquals("SiloHourlySnapshot", account + "-20015", "depositedBDV", "3000000000");
      assert.fieldEquals("SiloHourlySnapshot", account + "-20015", "deltaDepositedBDV", "1000000000");
      assert.fieldEquals(
        "SiloDailySnapshot",
        account + "-" + dayFromTimestamp(addV3_2.block.timestamp).toString(),
        "depositedBDV",
        "3000000000"
      );
      assert.fieldEquals(
        "SiloDailySnapshot",
        account + "-" + dayFromTimestamp(addV3_2.block.timestamp).toString(),
        "deltaDepositedBDV",
        "3000000000"
      );

      let addV3_3 = createAddDepositV3Event(account, token, BigInt.fromU32(90), 5000, 6, 4000);
      addV3_3.block = mockBlock(ZERO_BI, baseTimestamp.plus(hours15).plus(hours15));
      setSeason(20030);
      handleAddDeposit(addV3_3);

      assert.fieldEquals("SiloHourlySnapshot", account + "-20030", "depositedBDV", "7000000000");
      assert.fieldEquals("SiloHourlySnapshot", account + "-20030", "deltaDepositedBDV", "4000000000");
      assert.fieldEquals(
        "SiloDailySnapshot",
        account + "-" + dayFromTimestamp(addV3_3.block.timestamp).toString(),
        "depositedBDV",
        "7000000000"
      );
      assert.fieldEquals(
        "SiloDailySnapshot",
        account + "-" + dayFromTimestamp(addV3_3.block.timestamp).toString(),
        "deltaDepositedBDV",
        "4000000000"
      );
    });
  });

  describe("Whitelist", () => {
    test("Whitelist token v2", () => {
      handleWhitelistToken_v2(createWhitelistTokenV2Event(BEAN_ERC20.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234")));
      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "whitelistedTokens", "[" + BEAN_ERC20.toHexString() + "]");

      handleWhitelistToken_v2(
        createWhitelistTokenV2Event(BEAN_WETH_CP2_WELL.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234"))
      );
      assert.fieldEquals(
        "Silo",
        BEANSTALK.toHexString(),
        "whitelistedTokens",
        "[" + BEAN_ERC20.toHexString() + ", " + BEAN_WETH_CP2_WELL.toHexString() + "]"
      );
    });

    test("Whitelist token v3", () => {
      handleWhitelistToken_v3(createWhitelistTokenV3Event(BEAN_ERC20.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234")));
      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "whitelistedTokens", "[" + BEAN_ERC20.toHexString() + "]");

      handleWhitelistToken_v3(
        createWhitelistTokenV3Event(BEAN_WETH_CP2_WELL.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234"))
      );
      assert.fieldEquals(
        "Silo",
        BEANSTALK.toHexString(),
        "whitelistedTokens",
        "[" + BEAN_ERC20.toHexString() + ", " + BEAN_WETH_CP2_WELL.toHexString() + "]"
      );
    });

    // v4 tested in gauge test

    test("Dewhitelist token", () => {
      handleWhitelistToken_v2(createWhitelistTokenV2Event(BEAN_ERC20.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234")));
      handleWhitelistToken_v2(
        createWhitelistTokenV2Event(BEAN_WETH_CP2_WELL.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234"))
      );
      assert.fieldEquals(
        "Silo",
        BEANSTALK.toHexString(),
        "whitelistedTokens",
        "[" + BEAN_ERC20.toHexString() + ", " + BEAN_WETH_CP2_WELL.toHexString() + "]"
      );

      handleDewhitelistToken(createDewhitelistTokenEvent(BEAN_ERC20.toHexString()));
      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "whitelistedTokens", "[" + BEAN_WETH_CP2_WELL.toHexString() + "]");
      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "dewhitelistedTokens", "[" + BEAN_ERC20.toHexString() + "]");

      // Try dewhitelisting a non-whitelisted token. Nothing should happen
      handleDewhitelistToken(createDewhitelistTokenEvent(LUSD_3POOL.toHexString()));
      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "whitelistedTokens", "[" + BEAN_WETH_CP2_WELL.toHexString() + "]");
      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "dewhitelistedTokens", "[" + BEAN_ERC20.toHexString() + "]");
    });
  });
});

test("Legacy stem calculation", () => {
  assert.bigIntEquals(BigInt.fromI64(-5528000000), stemFromSeason(11446, BEAN_ERC20));
  assert.bigIntEquals(BigInt.fromI64(-31556000000), stemFromSeason(6321, BEAN_3CRV));
  assert.bigIntEquals(BigInt.fromI64(-16272000000), stemFromSeason(6074, UNRIPE_BEAN));
  assert.bigIntEquals(BigInt.fromI64(-32684000000), stemFromSeason(6039, UNRIPE_LP));
});
