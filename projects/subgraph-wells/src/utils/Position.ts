import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { Position } from "../../generated/schema";
import { loadOrCreateAccount } from "./Account";
import { emptyBigIntArray, ZERO_BD, ZERO_BI } from "./Decimals";
import { incrementWellPositions, loadWell } from "./Well";

export function loadOrCreatePosition(account: Address, wellAddress: Address, event: ethereum.Event): Position {
    let id = account.toHexString() + '-' + wellAddress.toHexString()
    let position = Position.load(id)
    if (position == null) {
        let well = loadWell(wellAddress)
        // Ensure the account exists
        loadOrCreateAccount(account)

        position = new Position(id)
        position.account = account
        position.well = wellAddress
        position.hashOpened = event.transaction.hash
        position.blockNumberOpened = event.block.number
        position.timestampOpened = event.block.timestamp
        position.liquidity = ZERO_BI
        position.liquidityUSD = ZERO_BD
        position.cumulativeDepositTokenAmounts = emptyBigIntArray(well.inputTokens.length)
        position.cumulativeDepositUSD = ZERO_BD
        position.cumulativeWithdrawTokenAmounts = emptyBigIntArray(well.inputTokens.length)
        position.cumulativeWithdrawUSD = ZERO_BD
        position.depositCount = 0
        position.withdrawCount = 0
        position.save()
    }
    return position as Position
}

export function loadPosition(account: Address, wellAddress: Address): Position {
    let id = account.toHexString() + '-' + wellAddress.toHexString()
    return Position.load(id) as Position
}

export function addDepositToPosition(account: Address, wellAddress: Address, tokenAmountsIn: BigInt[], lpAmountOut: BigInt): void {
    let position = loadPosition(account, wellAddress)

    if (position.liquidity == ZERO_BI) incrementWellPositions(wellAddress)

    position.liquidity = position.liquidity.plus(lpAmountOut)
    let balances = position.cumulativeDepositTokenAmounts
    for (let i = 0; i < position.cumulativeDepositTokenAmounts.length; i++)
        balances[i] = balances[i].plus(tokenAmountsIn[i])

    position.cumulativeDepositTokenAmounts = balances
    position.depositCount += 1
    position.save()
}
