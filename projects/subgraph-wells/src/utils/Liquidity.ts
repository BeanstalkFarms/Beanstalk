import { Deposit } from "../../generated/schema";
import { AddLiquidity } from "../../generated/templates/Well/Well";
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

export function loadDeposit(id: string): Deposit {
    return Deposit.load(id) as Deposit
}
