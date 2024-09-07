import { beforeEach, afterEach, clearStore, describe, assert, test } from "matchstick-as/assembly/index";
import { BEAN_3CRV, BEAN_ERC20, BEAN_ERC20_V1, BEAN_WETH_V1, CRV3_TOKEN, WETH } from "../../subgraph-core/constants/BeanstalkEth";
import { BigInt, Address } from "@graphprotocol/graph-ts";
import { loadOrCreatePool } from "../src/entities/Pool";
import { toAddress } from "../../subgraph-core/utils/Bytes";
import { initL1Version } from "./entity-mocking/MockVersion";

describe("Token", () => {
  beforeEach(() => {
    initL1Version();
  });
  afterEach(() => {
    clearStore();
  });

  test("Pool and its tokens are assigned appropriate metadata", () => {
    const pool = loadOrCreatePool(BEAN_WETH_V1, BigInt.fromU32(14500000));
    assert.addressEquals(BEAN_ERC20_V1, toAddress(pool.tokens[0]));
    assert.addressEquals(WETH, toAddress(pool.tokens[1]));

    assert.fieldEquals("Token", BEAN_ERC20_V1.toHexString(), "decimals", "6");
    assert.fieldEquals("Token", WETH.toHexString(), "decimals", "18");

    const pool2 = loadOrCreatePool(BEAN_3CRV, BigInt.fromU32(17500000));
    assert.addressEquals(BEAN_ERC20, toAddress(pool2.tokens[0]));
    assert.addressEquals(CRV3_TOKEN, toAddress(pool2.tokens[1]));

    assert.fieldEquals("Token", BEAN_ERC20.toHexString(), "decimals", "6");
    assert.fieldEquals("Token", CRV3_TOKEN.toHexString(), "decimals", "18");
  });
});
