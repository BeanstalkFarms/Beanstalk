import { BigDecimal, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as/assembly/index";
import {
  BEAN_3CRV,
  BEAN_ERC20,
  BEAN_WETH_CP2_WELL,
  BEANSTALK_PRICE_1,
  CRV3_TOKEN,
  WETH
} from "../../../subgraph-core/constants/BeanstalkEth";
import { BEAN_USD_PRICE, WELL } from "./Constants";
import { setMockBeanPrice } from "../../../subgraph-core/tests/event-mocking/Price";
import { ONE_BD, ZERO_BD } from "../../../subgraph-core/utils/Decimals";

let prevMocked = ZERO_BD;

export function createContractCallMocks(priceMultiple: BigDecimal = ONE_BD): void {
  if (prevMocked == priceMultiple) {
    return;
  }
  prevMocked = priceMultiple;

  const price = BigInt.fromString(new BigDecimal(BEAN_USD_PRICE).times(priceMultiple).truncate(0).toString());

  setMockBeanPrice({
    price: price,
    liquidity: BigInt.fromString("26025239751318").times(BigInt.fromU32(2)),
    deltaB: BigInt.fromString("-866349934591").times(BigInt.fromU32(2)),
    ps: [
      {
        contract: BEAN_3CRV,
        tokens: [BEAN_ERC20, CRV3_TOKEN],
        balances: [BigInt.fromString("14306013160240"), BigInt.fromString("12306817594155799426763734")],
        price: price,
        liquidity: BigInt.fromString("26025239751318"),
        deltaB: BigInt.fromString("-866349934591"),
        lpUsd: BigInt.fromString("969328"),
        lpBdv: BigInt.fromString("1032515")
      },
      {
        contract: BEAN_WETH_CP2_WELL,
        tokens: [BEAN_ERC20, WETH],
        balances: [BigInt.fromString("2000000000"), BigInt.fromString("1500000000000000000")],
        price: price,
        liquidity: BigInt.fromString("26025239751318"),
        deltaB: BigInt.fromString("-866349934591"),
        lpUsd: BigInt.fromString("969328"),
        lpBdv: BigInt.fromString("1032515")
      }
    ]
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
