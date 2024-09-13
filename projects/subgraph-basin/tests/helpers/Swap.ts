import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { BASIN_BLOCK, BEAN_ERC20, WETH } from "../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { handleShift, handleSwap } from "../../src/WellHandler";
import { BEAN_SWAP_AMOUNT, SWAP_ACCOUNT, WELL, WETH_SWAP_AMOUNT } from "./Constants";
import { createContractCallMocks } from "./Functions";
import { createShiftEvent, createSwapEvent } from "./Well";
import { ONE_BD } from "../../../subgraph-core/utils/Decimals";

export function mockSwap(beanPriceMultiple: BigDecimal = ONE_BD): string {
  createContractCallMocks(beanPriceMultiple);
  let newSwapEvent = createSwapEvent(WELL, SWAP_ACCOUNT, BEAN_ERC20, WETH, BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT);
  newSwapEvent.block.number = BASIN_BLOCK;
  handleSwap(newSwapEvent);
  return newSwapEvent.transaction.hash.toHexString() + "-" + newSwapEvent.logIndex.toString();
}

export function mockShift(newReserves: BigInt[], toToken: Address, amountOut: BigInt, beanPriceMultiple: BigDecimal = ONE_BD): string {
  createContractCallMocks(beanPriceMultiple);
  let newShiftEvent = createShiftEvent(WELL, SWAP_ACCOUNT, newReserves, toToken, amountOut);
  newShiftEvent.block.number = BASIN_BLOCK;
  handleShift(newShiftEvent);
  return newShiftEvent.transaction.hash.toHexString() + "-" + newShiftEvent.logIndex.toString();
}
