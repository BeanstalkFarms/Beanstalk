import { AddLiquidity, Approval, RemoveLiquidity, RemoveLiquidityOneToken, Swap, Transfer } from "../generated/templates/Well/Well";
import { recordSwapEvent } from "./utils/Swap";

export function handleAddLiquidity(event: AddLiquidity): void {

}

export function handleApproval(event: Approval): void {

}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {

}

export function handleRemoveLiquidityOneToken(event: RemoveLiquidityOneToken): void {

}

export function handleSwap(event: Swap): void {

    recordSwapEvent(event)

}

export function handleTransfer(event: Transfer): void {

}
