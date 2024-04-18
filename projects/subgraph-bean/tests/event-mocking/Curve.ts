import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { createMockedFunction } from "matchstick-as";

export function mock_virtual_price(contract: Address, retval: BigInt): void {
  createMockedFunction(contract, "get_virtual_price", "get_virtual_price():(uint256)")
    .withArgs([])
    .returns([ethereum.Value.fromUnsignedBigInt(retval)]);
}
