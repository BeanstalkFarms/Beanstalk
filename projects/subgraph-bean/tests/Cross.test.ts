import { afterEach, assert, clearStore, describe, test } from "matchstick-as/assembly/index";
import { log } from "matchstick-as/assembly/log";
import { BigInt } from "@graphprotocol/graph-ts";

import { handleBlock } from "../src/BeanWellHandler";
import { mockBlock } from "../../subgraph-core/tests/event-mocking/Block";
import { setMockWellPrice } from "../../subgraph-core/tests/event-mocking/Price";
import { BEAN_ERC20, BEAN_WETH_CP2_WELL, WETH } from "../../subgraph-core/utils/Constants";

describe("Well: Crosses", () => {
  afterEach(() => {
    log.debug("clearing the store", []);
    clearStore();
  });

  test("Well P > 1, Bean P > 1", () => {
    setMockWellPrice(
      BEAN_WETH_CP2_WELL,
      [BEAN_ERC20, WETH],
      [BigInt.fromString("2000000000"), BigInt.fromString("1500000000000000000")],
      BigInt.fromString("961000"),
      BigInt.fromString("26025239751318"),
      BigInt.fromString("-866349934591"),
      BigInt.fromString("969328"),
      BigInt.fromString("1032515")
    );
    handleBlock(mockBlock(BigInt.fromU32(19579092), BigInt.fromU32(1712193759)));

    // setMockBeanPrice(0.99);
    // setMockWellPrice(0.99);

    // handleBlock(mockBlock());

    // setMockBeanPrice(1.01);
    // setMockWellPrice(1.01);

    // handleBlock(mockBlock());
  });

  test("Well P < 1, Bean P < 1", () => {});

  test("Well P > 1, Bean P < 1", () => {});

  test("Well P < 1, Bean P > 1", () => {});
});
