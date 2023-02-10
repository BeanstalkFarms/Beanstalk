import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { BoreWellWellFunctionStruct } from "../../generated/Aquifer/Aquifer";
import { Well, WellFunction } from "../../generated/schema";
import { emptyBigDecimalArray, emptyBigIntArray, ZERO_BD, ZERO_BI } from "./Decimals";

export function createWell(wellAddress: Address, inputTokens: Address[]): Well {
    let well = Well.load(wellAddress)
    if (well !== null) { return well as Well }

    well = new Well(wellAddress)

    well.aquifer = Bytes.empty()
    well.tokens = [] // This is currently set in the `handleBoreWell` function
    well.createdTimestamp = ZERO_BI
    well.createdBlockNumber = ZERO_BI
    well.lpTokenSupply = ZERO_BI
    well.totalLiquidityUSD = ZERO_BD
    well.reserves = emptyBigIntArray(inputTokens.length)
    well.reservesUSD = emptyBigDecimalArray(inputTokens.length)
    well.cumulativeVolumeReserves = emptyBigIntArray(inputTokens.length)
    well.cumulativeVolumeReservesUSD = emptyBigDecimalArray(inputTokens.length)
    well.cumulativeVolumeUSD = ZERO_BD
    well.cumulativeDepositCount = 0
    well.cumulativeWithdrawCount = 0
    well.cumulativeSwapCount = 0
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

export function loadOrCreateWellFunction(functionData: BoreWellWellFunctionStruct, wellAddress: Address): WellFunction {
    let id = wellAddress.toHexString() + '-' + functionData.target.toHexString()
    let wellFunction = WellFunction.load(id)
    if (wellFunction == null) {
        wellFunction = new WellFunction(id)
        wellFunction.target = functionData.target
        wellFunction.data = functionData.data
        wellFunction.well = wellAddress
        wellFunction.save()
    }
    return wellFunction as WellFunction
}

export function updateWellVolumes(
    wellAddress: Address,
    fromToken: Address,
    amountIn: BigInt,
    toToken: Address,
    amountOut: BigInt
): void {
    let well = loadWell(wellAddress)

    let fromTokenIndex = well.tokens.indexOf(fromToken)
    let toTokenIndex = well.tokens.indexOf(toToken)

    // Update fromToken amounts

    let tokenVolumes = well.cumulativeVolumeReserves
    let tokenBalances = well.reserves

    tokenVolumes[fromTokenIndex] = tokenVolumes[fromTokenIndex].plus(amountIn)
    tokenBalances[fromTokenIndex] = tokenBalances[fromTokenIndex].plus(amountIn)

    tokenVolumes[toTokenIndex] = tokenVolumes[toTokenIndex].plus(amountOut)
    tokenBalances[toTokenIndex] = tokenBalances[toTokenIndex].minus(amountOut)

    well.cumulativeVolumeReserves = tokenVolumes
    well.reserves = tokenBalances

    well.save()
}

export function updateWellTokenBalances(
    wellAddress: Address,
    inputTokenAmounts: BigInt[]
): void {
    let well = loadWell(wellAddress)
    let balances = well.reserves

    for (let i = 0; i < balances.length; i++) {
        balances[i] = balances[i].plus(inputTokenAmounts[i])
    }

    well.reserves = balances
    well.save()
}

export function updateWellLiquidityTokenBalance(wellAddress: Address, deltaAmount: BigInt): void {
    let well = loadWell(wellAddress)
    well.lpTokenSupply = well.lpTokenSupply.plus(deltaAmount)
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
