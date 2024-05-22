import { BigInt } from "@graphprotocol/graph-ts";
import { afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import {
  handleAddDeposit,
  handleDewhitelistToken,
  handleRemoveDeposit,
  handleWhitelistToken,
  handleWhitelistToken_V3
} from "../src/SiloHandler";
import { BEAN_ERC20, BEAN_WETH_CP2_WELL, BEANSTALK, LUSD_3POOL } from "../../subgraph-core/utils/Constants";
import { createAddDepositEvent, createRemoveDepositEvent } from "./event-mocking/Silo";
import { createDewhitelistTokenEvent, createWhitelistTokenV2Event, createWhitelistTokenV3Event } from "./event-mocking/Whitelist";
import { ONE_BI } from "../../subgraph-core/utils/Decimals";

describe("Mocked Events", () => {
  afterEach(() => {
    clearStore();
  });

  describe("Bean", () => {
    test("AddDeposit - Silo and Assets updated", () => {
      let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
      let token = BEAN_ERC20.toHexString().toLowerCase();

      let newAddDepositEvent = createAddDepositEvent(account, token, 6100, 1000, 6, 1000);

      handleAddDeposit(newAddDepositEvent);

      assert.fieldEquals("Silo", account, "depositedBDV", "1000000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "1000000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedAmount", "1000000000");
    });

    test("RemoveDeposit - Farmer Silo Amounts 50% Initial", () => {
      let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
      let token = BEAN_ERC20.toHexString().toLowerCase();

      let newAddDepositEvent = createAddDepositEvent(account, token, 6100, 1000, 6, 1000);

      handleAddDeposit(newAddDepositEvent);

      let newRemoveDepositEvent = createRemoveDepositEvent(account, token, 6100, BigInt.fromString("500000000"));

      handleRemoveDeposit(newRemoveDepositEvent);

      assert.fieldEquals("Silo", account, "depositedBDV", "500000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-6100", "withdrawnAmount", "500000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-6100", "withdrawnBDV", "500000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "500000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedAmount", "500000000");
    });

    test("RemoveDeposit - Farmer Silo Amounts 50% Remaining", () => {
      let account = "0x1234567890abcdef1234567890abcdef12345678".toLowerCase();
      let token = BEAN_ERC20.toHexString().toLowerCase();

      let newAddDepositEvent = createAddDepositEvent(account, token, 6100, 1000, 6, 1000);

      handleAddDeposit(newAddDepositEvent);

      let newRemoveDepositEvent = createRemoveDepositEvent(account, token, 6100, BigInt.fromString("500000000"));

      handleRemoveDeposit(newRemoveDepositEvent);

      let secondRemoveDepositEvent = createRemoveDepositEvent(account, token, 6100, BigInt.fromString("250000000"));

      handleRemoveDeposit(secondRemoveDepositEvent);

      assert.fieldEquals("Silo", account, "depositedBDV", "250000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-6100", "withdrawnAmount", "750000000");
      assert.fieldEquals("SiloDeposit", account + "-" + token + "-6100", "withdrawnBDV", "750000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedBDV", "250000000");
      assert.fieldEquals("SiloAsset", account + "-" + token, "depositedAmount", "250000000");
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
