import { AddLiquidity, Approval, RemoveLiquidity, RemoveLiquidityOneToken, Swap, Transfer } from "../generated/templates/Well/Well";
import { loadOrCreateAccount } from "./utils/Account";
import { recordAddLiquidityEvent } from "./utils/Liquidity";
import { recordSwapEvent } from "./utils/Swap";
import { incrementWellDeposit, incrementWellSwap, updateWellLiquidityTokenBalance, updateWellTokenBalances, updateWellVolumes } from "./utils/Well";

export function handleAddLiquidity(event: AddLiquidity): void {

    loadOrCreateAccount(event.transaction.from)

    recordAddLiquidityEvent(event)

    updateWellTokenBalances(event.address, event.params.tokenAmountsIn)

    updateWellLiquidityTokenBalance(event.address, event.params.lpAmountOut)

    incrementWellDeposit(event.address)

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

