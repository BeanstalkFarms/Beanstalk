import { AddLiquidity, Approval, RemoveLiquidity, RemoveLiquidityOneToken, Swap, Transfer } from "../generated/templates/Well/Well";
import { loadOrCreateAccount } from "./utils/Account";
import { emptyBigIntArray, ZERO_BI } from "./utils/Decimals";
import { recordAddLiquidityEvent, recordRemoveLiquidityEvent, recordRemoveLiquidityOneEvent } from "./utils/Liquidity";
import { addDepositToPosition, loadOrCreatePosition } from "./utils/Position";
import { recordSwapEvent } from "./utils/Swap";
import { incrementWellDeposit, incrementWellSwap, incrementWellWithdraw, loadWell, updateWellLiquidityTokenBalance, updateWellTokenBalances, updateWellVolumes } from "./utils/Well";

export function handleAddLiquidity(event: AddLiquidity): void {

    loadOrCreatePosition(event.transaction.from, event.address, event)

    addDepositToPosition(event.transaction.from, event.address, event.params.tokenAmountsIn, event.params.lpAmountOut)

    recordAddLiquidityEvent(event)

    updateWellTokenBalances(event.address, event.params.tokenAmountsIn)

    updateWellLiquidityTokenBalance(event.address, event.params.lpAmountOut)

    incrementWellDeposit(event.address)

}

export function handleApproval(event: Approval): void {

}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {

    loadOrCreateAccount(event.transaction.from)

    recordRemoveLiquidityEvent(event)

    // Treat token balances as negative since we are removing liquidity
    let balances = event.params.tokenAmountsOut
    for (let i = 0; i < balances.length; i++) balances[i] = ZERO_BI.minus(balances[i])

    updateWellTokenBalances(event.address, balances)

    updateWellLiquidityTokenBalance(event.address, ZERO_BI.minus(event.params.lpAmountIn))

    incrementWellWithdraw(event.address)
}

export function handleRemoveLiquidityOneToken(event: RemoveLiquidityOneToken): void {

    // Pre-process amount out into an indexed array for the well's input tokens.

    let well = loadWell(event.address)
    let indexedBalances = emptyBigIntArray(well.inputTokens.length)

    indexedBalances[well.inputTokens.indexOf(event.params.tokenOut)] = indexedBalances[well.inputTokens.indexOf(event.params.tokenOut)].plus(event.params.tokenAmountOut)

    loadOrCreateAccount(event.transaction.from)

    recordRemoveLiquidityOneEvent(event, indexedBalances)

    // Flip to negative for updating well balances
    for (let i = 0; i < indexedBalances.length; i++) indexedBalances[i] = ZERO_BI.minus(indexedBalances[i])

    updateWellTokenBalances(event.address, indexedBalances)

    updateWellLiquidityTokenBalance(event.address, ZERO_BI.minus(event.params.lpAmountIn))

    incrementWellWithdraw(event.address)

}

export function handleSwap(event: Swap): void {

    loadOrCreateAccount(event.transaction.from)

    recordSwapEvent(event)

    updateWellVolumes(event.address, event.params.fromToken, event.params.amountIn, event.params.toToken, event.params.amountOut)

    incrementWellSwap(event.address)

}

export function handleTransfer(event: Transfer): void {

}

