import { Deposit, Withdraw } from "../../generated/schema";
import { AddLiquidity, RemoveLiquidity } from "../../generated/templates/Well/Well";
import { ZERO_BD } from "./Decimals";
import { loadWell } from "./Well";

export function recordAddLiquidityEvent(event: AddLiquidity): void {
    let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let deposit = new Deposit(id)
    let receipt = event.receipt
    let well = loadWell(event.address)

    deposit.hash = event.transaction.hash
    deposit.nonce = event.transaction.nonce
    deposit.logIndex = event.logIndex.toI32()
    deposit.gasLimit = event.transaction.gasLimit
    if (receipt !== null) { deposit.gasUsed = receipt.gasUsed }
    deposit.gasPrice = event.transaction.gasPrice
    deposit.account = event.transaction.from
    deposit.well = event.address
    deposit.blockNumber = event.block.number
    deposit.timestamp = event.block.timestamp
    deposit.liquidity = event.params.lpAmountOut
    deposit.inputTokens = well.inputTokens
    deposit.inputTokenAmounts = event.params.tokenAmountsIn
    deposit.amountUSD = ZERO_BD
    deposit.save()
}

export function recordRemoveLiquidityEvent(event: RemoveLiquidity): void {
    let id = event.transaction.hash.toHexString() + '-' + event.logIndex.toString()
    let withdraw = new Withdraw(id)
    let receipt = event.receipt
    let well = loadWell(event.address)

    withdraw.hash = event.transaction.hash
    withdraw.nonce = event.transaction.nonce
    withdraw.logIndex = event.logIndex.toI32()
    withdraw.gasLimit = event.transaction.gasLimit
    if (receipt !== null) { withdraw.gasUsed = receipt.gasUsed }
    withdraw.gasPrice = event.transaction.gasPrice
    withdraw.account = event.transaction.from
    withdraw.well = event.address
    withdraw.blockNumber = event.block.number
    withdraw.timestamp = event.block.timestamp
    withdraw.liquidity = event.params.lpAmountIn
    withdraw.inputTokens = well.inputTokens
    withdraw.inputTokenAmounts = event.params.tokenAmountsOut
    withdraw.amountUSD = ZERO_BD
    withdraw.save()
}
