import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";
import { BEANSTALK_PRICE, BEAN_ERC20, BEAN_WETH_CP2_WELL, CURVE_PRICE, WETH } from "../../../subgraph-core/utils/Constants";
import { BEAN_USD_PRICE, WELL } from "./Constants";

export function createContractCallMocks(): void {
  let priceReturn = new ethereum.Tuple();

  priceReturn.push(ethereum.Value.fromAddress(Address.fromString("0xc9C32cd16Bf7eFB85Ff14e0c8603cc90F6F2eE49")));
  priceReturn.push(
    ethereum.Value.fromArray([
      ethereum.Value.fromAddress(Address.fromString("0xBEA0000029AD1c77D3d5D23Ba2D8893dB9d1Efab")),
      ethereum.Value.fromAddress(Address.fromString("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490"))
    ])
  );
  priceReturn.push(
    ethereum.Value.fromUnsignedBigIntArray([BigInt.fromString("14306013160240"), BigInt.fromString("12306817594155799426763734")])
  );
  priceReturn.push(ethereum.Value.fromUnsignedBigInt(BEAN_USD_PRICE));
  priceReturn.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromString("26025239751318")));
  priceReturn.push(ethereum.Value.fromSignedBigInt(BigInt.fromString("-866349934591")));
  priceReturn.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromString("969328")));
  priceReturn.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromString("1032515")));

  let wellPriceReturn = new ethereum.Tuple();

  wellPriceReturn.push(ethereum.Value.fromAddress(BEAN_WETH_CP2_WELL));
  wellPriceReturn.push(ethereum.Value.fromArray([ethereum.Value.fromAddress(BEAN_ERC20), ethereum.Value.fromAddress(WETH)]));
  wellPriceReturn.push(ethereum.Value.fromUnsignedBigIntArray([BigInt.fromString("2000000000"), BigInt.fromString("1500000000000000000")]));
  wellPriceReturn.push(ethereum.Value.fromUnsignedBigInt(BEAN_USD_PRICE));
  wellPriceReturn.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromString("26025239751318")));
  wellPriceReturn.push(ethereum.Value.fromSignedBigInt(BigInt.fromString("-866349934591")));
  wellPriceReturn.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromString("969328")));
  wellPriceReturn.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromString("1032515")));

  createMockedFunction(CURVE_PRICE, "getCurve", "getCurve():((address,address[2],uint256[2],uint256,uint256,int256,uint256,uint256))")
    .withArgs([])
    .returns([ethereum.Value.fromTuple(priceReturn)]);

  createMockedFunction(
    BEANSTALK_PRICE,
    "getConstantProductWell",
    "getConstantProductWell(address):((address,address[2],uint256[2],uint256,uint256,int256,uint256,uint256))"
  )
    .withArgs([ethereum.Value.fromAddress(BEAN_WETH_CP2_WELL)])
    .returns([ethereum.Value.fromTuple(wellPriceReturn)]);

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
