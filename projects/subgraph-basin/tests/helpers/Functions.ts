import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";
import { BEAN_3CRV, BEAN_ERC20, BEAN_WETH_CP2_WELL, CRV3_TOKEN, WETH } from "../../../subgraph-core/utils/Constants";
import { BEAN_USD_PRICE, WELL } from "./Constants";
import { setMockCurvePrice, setMockWellPrice } from "../../../subgraph-core/tests/event-mocking/Price";

export function createContractCallMocks(): void {
  setMockCurvePrice({
    contract: BEAN_3CRV,
    tokens: [BEAN_ERC20, CRV3_TOKEN],
    balances: [BigInt.fromString("14306013160240"), BigInt.fromString("12306817594155799426763734")],
    price: BEAN_USD_PRICE,
    liquidity: BigInt.fromString("26025239751318"),
    deltaB: BigInt.fromString("-866349934591"),
    lpUsd: BigInt.fromString("969328"),
    lpBdv: BigInt.fromString("1032515")
  });

  setMockWellPrice({
    contract: BEAN_WETH_CP2_WELL,
    tokens: [BEAN_ERC20, WETH],
    balances: [BigInt.fromString("2000000000"), BigInt.fromString("1500000000000000000")],
    price: BEAN_USD_PRICE,
    liquidity: BigInt.fromString("26025239751318"),
    deltaB: BigInt.fromString("-866349934591"),
    lpUsd: BigInt.fromString("969328"),
    lpBdv: BigInt.fromString("1032515")
  });

  createMockedFunction(BEAN_ERC20, "name", "name():(string)")
    .withArgs([])
    .returns([ethereum.Value.fromString("Bean")]);

  createMockedFunction(WELL, "name", "name():(string)")
    .withArgs([])
    .returns([ethereum.Value.fromString("Bean")]);

  createMockedFunction(WETH, "name", "name():(string)")
    .withArgs([])
    .returns([ethereum.Value.fromString("WETH")]);

  createMockedFunction(BEAN_ERC20, "symbol", "symbol():(string)")
    .withArgs([])
    .returns([ethereum.Value.fromString("BEAN")]);

  createMockedFunction(WELL, "symbol", "symbol():(string)")
    .withArgs([])
    .returns([ethereum.Value.fromString("BEAN-WETH-wCP2")]);

  createMockedFunction(WETH, "symbol", "symbol():(string)")
    .withArgs([])
    .returns([ethereum.Value.fromString("WETH")]);

  createMockedFunction(BEAN_ERC20, "decimals", "decimals():(uint8)")
    .withArgs([])
    .returns([ethereum.Value.fromI32(6)]);

  createMockedFunction(WELL, "decimals", "decimals():(uint8)")
    .withArgs([])
    .returns([ethereum.Value.fromI32(12)]);

  createMockedFunction(WETH, "decimals", "decimals():(uint8)")
    .withArgs([])
    .returns([ethereum.Value.fromI32(18)]);
}
