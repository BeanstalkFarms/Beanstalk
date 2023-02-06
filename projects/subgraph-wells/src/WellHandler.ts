import { AddLiquidity, Approval, RemoveLiquidity, RemoveLiquidityOneToken, Swap, Transfer } from "../generated/templates/Well/Well";
import { loadOrCreateAccount } from "./utils/Account";
import { recordSwapEvent } from "./utils/Swap";
import { incrementWellSwap, updateWellVolumes } from "./utils/Well";

export function handleAddLiquidity(event: AddLiquidity): void {

}

export function handleApproval(event: Approval): void {

}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {

}

export function handleRemoveLiquidityOneToken(event: RemoveLiquidityOneToken): void {

}

export function handleSwap(event: Swap): void {

    loadOrCreateAccount(event.transaction.from)

    recordSwapEvent(event)

    updateWellVolumes(event.address, event.params.fromToken, event.params.amountIn, event.params.toToken, event.params.amountOut)

    incrementWellSwap(event.address)

}

export function handleTransfer(event: Transfer): void {

}

