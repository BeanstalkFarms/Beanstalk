import { handleAddLiquidity } from "../../src/WellHandler"
import { BEAN_SWAP_AMOUNT, SWAP_ACCOUNT, WELL, WELL_LP_AMOUNT, WETH_SWAP_AMOUNT } from "./Constants"
import { createAddLiquidityEvent } from "./Well"

export function createDefaultAddLiquidity(): string {
    let newEvent = createAddLiquidityEvent(WELL, SWAP_ACCOUNT, WELL_LP_AMOUNT, [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT])
    handleAddLiquidity(newEvent)
    return newEvent.transaction.hash.toHexString() + '-' + newEvent.logIndex.toString()
}
