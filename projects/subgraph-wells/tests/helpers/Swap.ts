import { BEAN_ERC20, WETH } from "../../src/utils/Constants"
import { handleSwap } from "../../src/WellHandler"
import { BEAN_SWAP_AMOUNT, WELL, WETH_SWAP_AMOUNT } from "./Constants"
import { createSwapEvent } from "./Well"

export function createDefaultSwap(): string {
    let newSwapEvent = createSwapEvent(WELL, BEAN_ERC20, WETH, BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT)
    handleSwap(newSwapEvent)
    return newSwapEvent.transaction.hash.toHexString() + '-' + newSwapEvent.logIndex.toString()
}
