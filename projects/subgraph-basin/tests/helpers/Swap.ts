import { Address, BigInt } from "@graphprotocol/graph-ts";
import { BEAN_ERC20, WETH } from "../../../subgraph-core/utils/Constants";
import { handleShift, handleSwap } from "../../src/WellHandler";
import { BEAN_SWAP_AMOUNT, SWAP_ACCOUNT, WELL, WETH_SWAP_AMOUNT } from "./Constants";
import { createContractCallMocks } from "./Functions";
import { createShiftEvent, createSwapEvent } from "./Well";

export function mockSwap(): string {
  createContractCallMocks();
  let newSwapEvent = createSwapEvent(WELL, SWAP_ACCOUNT, BEAN_ERC20, WETH, BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT);
  handleSwap(newSwapEvent);
  return newSwapEvent.transaction.hash.toHexString() + "-" + newSwapEvent.logIndex.toString();
}

export function mockShift(newReserves: BigInt[], toToken: Address, amountOut: BigInt): string {
  createContractCallMocks();
  let newShiftEvent = createShiftEvent(WELL, SWAP_ACCOUNT, newReserves, toToken, amountOut);
  handleShift(newShiftEvent);
  return newShiftEvent.transaction.hash.toHexString() + "-" + newShiftEvent.logIndex.toString();
}
