import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { Well } from "../../generated/schema";
import { ADDRESS_ZERO } from "./Constants";
import { emptyBigDecimalArray, emptyBigIntArray, ZERO_BD, ZERO_BI } from "./Decimals";

export function createWell(wellAddress: Address, inputTokens: Address[]): Well {
    let well = Well.load(wellAddress)
    if (well !== null) { return well as Well }

    well = new Well(wellAddress)

    well.aquifer = Bytes.empty()
    well.inputTokens = [] // This is currently set in the `handleBoreWell` function
    well.wellFunction = ADDRESS_ZERO
    well.createdTimestamp = ZERO_BI
    well.createdBlockNumber = ZERO_BI
    well.totalLiquidity = ZERO_BI
    well.totalLiquidityUSD = ZERO_BD
    well.cumulativeVolumeTokenAmounts = emptyBigIntArray(inputTokens.length)
    well.cumulativeVolumesUSD = emptyBigDecimalArray(inputTokens.length)
    well.cumulativeVolumeUSD = ZERO_BD
    well.inputTokenBalances = emptyBigIntArray(inputTokens.length)
    well.inputTokenBalancesUSD = emptyBigDecimalArray(inputTokens.length)
    well.cumulativeDepositCount = 0
    well.cumulativeWithdrawCount = 0
    well.cumulativeSwapCount = 0
    well.positionCount = 0
    well.openPositionCount = 0
    well.closedPositionCount = 0
    well.lastSnapshotDayID = 0
    well.lastSnapshotHourID = 0
    well.lastUpdateTimestamp = ZERO_BI
    well.lastUpdateBlockNumber = ZERO_BI
    well.save()

    return well as Well
}

export function loadWell(wellAddress: Address): Well {
    return Well.load(wellAddress) as Well
}

export function updateWellVolumes(
    wellAddress: Address,
    fromToken: Address,
    amountIn: BigInt,
    toToken: Address,
    amountOut: BigInt
): void {
    let well = loadWell(wellAddress)

    let fromTokenIndex = well.inputTokens.indexOf(fromToken)
    let toTokenIndex = well.inputTokens.indexOf(toToken)

    // Update fromToken amounts

    let tokenVolumes = well.cumulativeVolumeTokenAmounts
    let tokenBalances = well.inputTokenBalances

    tokenVolumes[fromTokenIndex] = tokenVolumes[fromTokenIndex].plus(amountIn)
    tokenBalances[fromTokenIndex] = tokenBalances[fromTokenIndex].plus(amountIn)

    tokenVolumes[toTokenIndex] = tokenVolumes[toTokenIndex].plus(amountOut)
    tokenBalances[toTokenIndex] = tokenBalances[toTokenIndex].minus(amountOut)

    well.cumulativeVolumeTokenAmounts = tokenVolumes
    well.inputTokenBalances = tokenBalances

    well.save()

}

export function updateWellTokenBalances(
    wellAddress: Address,
    inputTokenAmounts: BigInt[]
): void {
    let well = loadWell(wellAddress)
    let balances = well.inputTokenBalances

    for (let i = 0; i < balances.length; i++) {
        balances[i] = balances[i].plus(inputTokenAmounts[i])
    }

    well.inputTokenBalances = balances
    well.save()
}

export function updateWellLiquidityTokenBalance(wellAddress: Address, deltaAmount: BigInt): void {
    let well = loadWell(wellAddress)
    well.totalLiquidity = well.totalLiquidity.plus(deltaAmount)
    well.save()
}

export function incrementWellSwap(wellAddress: Address): void {
    let well = loadWell(wellAddress)
    well.cumulativeSwapCount += 1
    well.save()
}

export function incrementWellDeposit(wellAddress: Address): void {
    let well = loadWell(wellAddress)
    well.cumulativeDepositCount += 1
    well.save()
}

export function incrementWellWithdraw(wellAddress: Address): void {
    let well = loadWell(wellAddress)
    well.cumulativeWithdrawCount += 1
    well.save()
}

export function incrementWellPositions(wellAddress: Address): void {
    let well = loadWell(wellAddress)
    well.positionCount += 1
    well.openPositionCount += 1
    well.save()
}
