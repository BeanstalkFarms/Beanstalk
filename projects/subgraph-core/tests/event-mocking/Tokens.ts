import { BigInt, Address, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as/assembly/index";

export function mockERC20TokenSupply(token: Address, supply: BigInt): void {
  createMockedFunction(token, "totalSupply", "totalSupply():(uint256)")
    .withArgs([])
    .returns([ethereum.Value.fromUnsignedBigInt(supply)]);
}
