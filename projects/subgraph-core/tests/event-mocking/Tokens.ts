import { BigInt, Address, ethereum, Bytes } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as/assembly/index";

export function mockERC20TokenSupply(token: Address, supply: BigInt): void {
  createMockedFunction(token, "totalSupply", "totalSupply():(uint256)")
    .withArgs([])
    .returns([ethereum.Value.fromUnsignedBigInt(supply)]);
}

export function mockWellLpTokenUnderlying(
  wellFunction: Address,
  lpAmount: BigInt,
  reserves: BigInt[],
  totalLpTokens: BigInt,
  data: Bytes,
  returnValues: BigInt[]
): void {
  createMockedFunction(wellFunction, "calcLPTokenUnderlying", "calcLPTokenUnderlying(uint256,uint256[],uint256,bytes):(uint256[])")
    .withArgs([
      ethereum.Value.fromUnsignedBigInt(lpAmount),
      ethereum.Value.fromUnsignedBigIntArray(reserves),
      ethereum.Value.fromUnsignedBigInt(totalLpTokens),
      ethereum.Value.fromBytes(data)
    ])
    .returns([ethereum.Value.fromUnsignedBigIntArray(returnValues)]);
}
