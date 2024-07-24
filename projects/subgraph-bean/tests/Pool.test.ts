import { afterEach, clearStore, describe, assert, test } from "matchstick-as/assembly/index";
import { loadOrCreateToken } from "../src/utils/Token";
import { BEAN_3CRV, BEAN_ERC20, BEAN_ERC20_V1, BEAN_WETH_V1, CRV3_TOKEN, WETH } from "../../subgraph-core/utils/Constants";
import { BigInt } from "@graphprotocol/graph-ts";
import { loadOrCreatePool } from "../src/utils/Pool";

describe("Token", () => {
  afterEach(() => {
    clearStore();
  });

  test("Pool and its tokens are assigned appropriate metadata", () => {
    const pool = loadOrCreatePool(BEAN_WETH_V1.toHexString(), BigInt.fromU32(14500000));
    assert.stringEquals(BEAN_ERC20_V1.toHexString(), pool.tokens[0]);
    assert.stringEquals(WETH.toHexString(), pool.tokens[1]);

    assert.fieldEquals("Token", BEAN_ERC20_V1.toHexString(), "decimals", "6");
    assert.fieldEquals("Token", WETH.toHexString(), "decimals", "18");

    const pool2 = loadOrCreatePool(BEAN_3CRV.toHexString(), BigInt.fromU32(17500000));
    assert.stringEquals(BEAN_ERC20.toHexString(), pool2.tokens[0]);
    assert.stringEquals(CRV3_TOKEN.toHexString(), pool2.tokens[1]);

    assert.fieldEquals("Token", BEAN_ERC20.toHexString(), "decimals", "6");
    assert.fieldEquals("Token", CRV3_TOKEN.toHexString(), "decimals", "18");
  });
});
