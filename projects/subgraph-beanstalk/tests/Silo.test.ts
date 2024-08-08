import { BigInt } from "@graphprotocol/graph-ts";
import { afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import {
  handleAddDeposit,
  handleAddDeposit_V3,
  handleDewhitelistToken,
  handleRemoveDeposit,
  handleRemoveDeposit_V3,
  handleRemoveDeposits,
  handleWhitelistToken,
  handleWhitelistToken_V3
} from "../src/SiloHandler";
import {
  BEAN_3CRV,
  BEAN_ERC20,
  BEAN_WETH_CP2_WELL,
  BEANSTALK,
  GAUGE_BIP45_BLOCK,
  LUSD_3POOL,
  UNRIPE_BEAN,
  UNRIPE_BEAN_3CRV
} from "../../subgraph-core/utils/Constants";
import {
  createAddDepositV2Event,
  createAddDepositV3Event,
  createRemoveDepositsV2Event,
  createRemoveDepositsV3Event,
  createRemoveDepositV2Event,
  createRemoveDepositV3Event
} from "./event-mocking/Silo";
import { createDewhitelistTokenEvent, createWhitelistTokenV2Event, createWhitelistTokenV3Event } from "./event-mocking/Whitelist";
import { ONE_BI } from "../../subgraph-core/utils/Decimals";
import { stemFromSeason } from "../src/utils/contracts/SiloCalculations";
import { setSeason } from "./utils/Season";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";

describe("Silo Events", () => {
  afterEach(() => {
    clearStore();
  });

  describe("Deposit/Withdraw", () => {
    test("AddDeposit - Silo v2", () => {
      let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
      let token = BEAN_ERC20.toHexString().toLowerCase();

      let newAddDepositEvent = createAddDepositV2Event(account, token, 6100, 1000, 6, 1000);
      handleAddDeposit(newAddDepositEvent);

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
      handleAddDeposit_V3(newAddDepositEvent);

      assert.fieldEquals("Silo", account, "depositedBDV", "1000000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-1500", "stem", "1500");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-1500", "depositVersion", "v3");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-1500", "stemV31", "1500000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-stem-1500", "depositedAmount", "1000000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "1000000000");

      // with V3.1 stem
      let addDeposit31 = createAddDepositV3Event(account, token, BigInt.fromI64(5700000000), 2500, 6, 2500);
      addDeposit31.block = mockBlock(GAUGE_BIP45_BLOCK.plus(ONE_BI));
      handleAddDeposit_V3(addDeposit31);

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
      handleAddDeposit(newAddDepositEvent);

      let newRemoveDepositEvent = createRemoveDepositV2Event(account, token, 6100, BigInt.fromString("800000000"));
      handleRemoveDeposit(newRemoveDepositEvent);

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
      handleAddDeposit(newAddDepositEvent);

      let removeEvent = createRemoveDepositV2Event(account, token, 6100, BigInt.fromString("500000000"));
      handleRemoveDeposit(removeEvent);

      let removeEvent2 = createRemoveDepositV2Event(account, token, 6100, BigInt.fromString("200000000"));
      handleRemoveDeposit(removeEvent2);

      assert.fieldEquals("Silo", account, "depositedBDV", "300000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "depositedAmount", "300000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-season-6100", "depositedBDV", "300000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "300000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedAmount", "300000000");

      // Remove the deposit completely
      let removeEvent3 = createRemoveDepositV2Event(account, token, 6100, BigInt.fromString("300000000"));
      handleRemoveDeposit(removeEvent3);

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
      handleAddDeposit(addV2_1);
      let addV3_1 = createAddDepositV3Event(account1, token1, BigInt.fromU32(70), 2000, 6, 2000);
      handleAddDeposit_V3(addV3_1);
      let addV3_2 = createAddDepositV3Event(account1, token2, BigInt.fromU32(50), 1000, 6, 1000);
      handleAddDeposit_V3(addV3_2);
      let addV3_3 = createAddDepositV3Event(account2, token2, BigInt.fromU32(90), 5000, 6, 4000);
      handleAddDeposit_V3(addV3_3);

      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "depositedBDV", "8000000000");
      assert.fieldEquals("Silo", account1, "depositedBDV", "4000000000");
      assert.fieldEquals("Silo", account2, "depositedBDV", "4000000000");
      assert.fieldEquals("SiloAsset", BEANSTALK.toHexString() + "-" + token1, "depositedBDV", "3000000000");
      assert.fieldEquals("SiloAsset", BEANSTALK.toHexString() + "-" + token2, "depositedBDV", "5000000000");
      assert.fieldEquals("SiloAsset", account1 + "-" + token1, "depositedBDV", "3000000000");
      assert.fieldEquals("SiloAsset", account1 + "-" + token2, "depositedBDV", "1000000000");
      assert.fieldEquals("SiloAsset", account2 + "-" + token2, "depositedBDV", "4000000000");

      let removeV2_1 = createRemoveDepositsV2Event(account1, token1, [6100], [BigInt.fromU32(1000000000)], BigInt.fromU32(1000000000));
      handleRemoveDeposits(removeV2_1);
      let removeV3_1 = createRemoveDepositV3Event(
        account2,
        token2,
        BigInt.fromU32(90),
        BigInt.fromU32(1500000000),
        BigInt.fromU32(1500000000)
      );
      handleRemoveDeposit_V3(removeV3_1);

      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "depositedBDV", "5500000000");
      assert.fieldEquals("Silo", account1, "depositedBDV", "3000000000");
      assert.fieldEquals("Silo", account2, "depositedBDV", "2500000000");
      assert.fieldEquals("SiloAsset", BEANSTALK.toHexString() + "-" + token1, "depositedBDV", "2000000000");
      assert.fieldEquals("SiloAsset", BEANSTALK.toHexString() + "-" + token2, "depositedBDV", "3500000000");
      assert.fieldEquals("SiloAsset", account1 + "-" + token1, "depositedBDV", "2000000000");
      assert.fieldEquals("SiloAsset", account1 + "-" + token2, "depositedBDV", "1000000000");
      assert.fieldEquals("SiloAsset", account2 + "-" + token2, "depositedBDV", "2500000000");
    });
  });

  describe("Whitelist", () => {
    test("Whitelist token v2", () => {
      handleWhitelistToken(createWhitelistTokenV2Event(BEAN_ERC20.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234")));
      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "whitelistedTokens", "[" + BEAN_ERC20.toHexString() + "]");

      handleWhitelistToken(createWhitelistTokenV2Event(BEAN_WETH_CP2_WELL.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234")));
      assert.fieldEquals(
        "Silo",
        BEANSTALK.toHexString(),
        "whitelistedTokens",
        "[" + BEAN_ERC20.toHexString() + ", " + BEAN_WETH_CP2_WELL.toHexString() + "]"
      );
    });

    test("Whitelist token v3", () => {
      handleWhitelistToken_V3(createWhitelistTokenV3Event(BEAN_ERC20.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234")));
      assert.fieldEquals("Silo", BEANSTALK.toHexString(), "whitelistedTokens", "[" + BEAN_ERC20.toHexString() + "]");

      handleWhitelistToken_V3(
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
      handleWhitelistToken(createWhitelistTokenV2Event(BEAN_ERC20.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234")));
      handleWhitelistToken(createWhitelistTokenV2Event(BEAN_WETH_CP2_WELL.toHexString(), "0xabcd1234", ONE_BI, BigInt.fromString("1234")));
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
  assert.bigIntEquals(BigInt.fromI64(-32684000000), stemFromSeason(6039, UNRIPE_BEAN_3CRV));
});
