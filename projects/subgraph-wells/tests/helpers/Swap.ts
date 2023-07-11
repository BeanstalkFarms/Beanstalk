import { BEAN_ERC20, WETH } from "../../../subgraph-core/utils/Constants";
import { handleSwap } from "../../src/WellHandler";
import { BEAN_SWAP_AMOUNT, SWAP_ACCOUNT, WELL, WETH_SWAP_AMOUNT } from "./Constants";
import { createContractCallMocks } from "./Functions";
import { createSwapEvent } from "./Well";

export function createDefaultSwap(): string {
  createContractCallMocks();
  let newSwapEvent = createSwapEvent(WELL, SWAP_ACCOUNT, BEAN_ERC20, WETH, BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT);
  handleSwap(newSwapEvent);
  return newSwapEvent.transaction.hash.toHexString() + "-" + newSwapEvent.logIndex.toString();
}
