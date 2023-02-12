import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { BoreWellWellFunctionStruct } from "../../generated/Aquifer/Aquifer";
import { Well, WellDailySnapshot, WellFunction, WellHourlySnapshot } from "../../generated/schema";
import { dayFromTimestamp, hourFromTimestamp } from "./Dates";
import { deltaBigDecimalArray, deltaBigIntArray, emptyBigDecimalArray, emptyBigIntArray, ZERO_BD, ZERO_BI } from "./Decimals";

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

export function checkForSnapshot(wellAddress: Address, timestamp: BigInt, blockNumber: BigInt): void {
    // We check for the prior period snapshot and then take one if needed
    let dayID = dayFromTimestamp(timestamp) - 1
    let hourID = hourFromTimestamp(timestamp) - 1

    let well = loadWell(wellAddress)

    if(dayID > well.lastSnapshotDayID ) takeWellDailySnapshot(wellAddress, dayID, timestamp, blockNumber)
    if(hourID > well.lastSnapshotHourID ) takeWellHourlySnapshot(wellAddress, hourID, timestamp, blockNumber)
}

export function takeWellDailySnapshot(wellAddress: Address, dayID: i32, timestamp: BigInt, blockNumber: BigInt): void {
    let well = loadWell(wellAddress)

    if (well.lastSnapshotDayID == 0) {
        loadOrCreateWellDailySnapshot(wellAddress, dayID, timestamp, blockNumber)
        well.lastSnapshotDayID = dayID
        well.save()
        return
    }

    let priorDay = well.lastSnapshotDayID
    well.lastSnapshotDayID = dayID
    well.save()

    let priorSnapshot = loadOrCreateWellDailySnapshot(wellAddress, priorDay, timestamp, blockNumber)
    let newSnapshot = loadOrCreateWellDailySnapshot(wellAddress, well.lastSnapshotDayID, timestamp, blockNumber)

    newSnapshot.deltalpTokenSupply = newSnapshot.lpTokenSupply.minus(priorSnapshot.lpTokenSupply)
    newSnapshot.deltaLiquidityUSD = newSnapshot.totalLiquidityUSD.minus(priorSnapshot.totalLiquidityUSD)
    newSnapshot.deltaVolumeReserves = deltaBigIntArray(newSnapshot.cumulativeVolumeReserves, priorSnapshot.cumulativeVolumeReserves)
    newSnapshot.deltaVolumeReservesUSD = deltaBigDecimalArray(newSnapshot.cumulativeVolumeReservesUSD, priorSnapshot.cumulativeVolumeReservesUSD)
    newSnapshot.deltaVolumeUSD = newSnapshot.cumulativeVolumeUSD.minus(priorSnapshot.cumulativeVolumeUSD)
    newSnapshot.deltaDepositCount = newSnapshot.cumulativeDepositCount - priorSnapshot.cumulativeDepositCount
    newSnapshot.deltaWithdrawCount = newSnapshot.cumulativeWithdrawCount - priorSnapshot.cumulativeWithdrawCount
    newSnapshot.deltaSwapCount = newSnapshot.cumulativeSwapCount - priorSnapshot.cumulativeSwapCount
    newSnapshot.lastUpdateTimestamp = timestamp
    newSnapshot.lastUpdateBlockNumber = blockNumber
    newSnapshot.save()
}

export function loadOrCreateWellDailySnapshot(wellAddress: Address, dayID: i32, timestamp: BigInt, blockNumber: BigInt): WellDailySnapshot {
    let snapshot = WellDailySnapshot.load(wellAddress.concatI32(dayID))
    log.info('Creating daily snapshot',[])
    if (snapshot == null) {
        let well = loadWell(wellAddress)
        snapshot = new WellDailySnapshot(wellAddress.concatI32(dayID))
        snapshot.day = dayID
        snapshot.well = wellAddress
        snapshot.lpTokenSupply = well.lpTokenSupply
        snapshot.totalLiquidityUSD = well.totalLiquidityUSD
        snapshot.cumulativeVolumeReserves = well.cumulativeVolumeReserves
        snapshot.cumulativeVolumeReservesUSD = well.cumulativeVolumeReservesUSD
        snapshot.cumulativeVolumeUSD = well.cumulativeVolumeUSD
        snapshot.cumulativeDepositCount = well.cumulativeDepositCount
        snapshot.cumulativeWithdrawCount = well.cumulativeWithdrawCount
        snapshot.cumulativeSwapCount = well.cumulativeSwapCount
        snapshot.deltalpTokenSupply = ZERO_BI
        snapshot.deltaLiquidityUSD = ZERO_BD
        snapshot.deltaVolumeReserves = emptyBigIntArray(well.tokens.length)
        snapshot.deltaVolumeReservesUSD = emptyBigDecimalArray(well.tokens.length)
        snapshot.deltaVolumeUSD = ZERO_BD
        snapshot.deltaDepositCount = 0
        snapshot.deltaWithdrawCount = 0
        snapshot.deltaSwapCount = 0 
        snapshot.lastUpdateTimestamp = timestamp
        snapshot.lastUpdateBlockNumber = blockNumber
        snapshot.save()
    }
    return snapshot as WellDailySnapshot
}

export function takeWellHourlySnapshot(wellAddress: Address, hourID: i32, timestamp: BigInt, blockNumber: BigInt): void {
    let well = loadWell(wellAddress)

    let priorHourID = well.lastSnapshotHourID
    well.lastSnapshotHourID = hourID
    well.save()

    let priorSnapshot = loadOrCreateWellHourlySnapshot(wellAddress, priorHourID, timestamp, blockNumber)
    let newSnapshot = loadOrCreateWellHourlySnapshot(wellAddress, well.lastSnapshotHourID, timestamp, blockNumber)

    newSnapshot.deltalpTokenSupply = newSnapshot.lpTokenSupply.minus(priorSnapshot.lpTokenSupply)
    newSnapshot.deltaLiquidityUSD = newSnapshot.totalLiquidityUSD.minus(priorSnapshot.totalLiquidityUSD)
    newSnapshot.deltaVolumeReserves = deltaBigIntArray(newSnapshot.cumulativeVolumeReserves, priorSnapshot.cumulativeVolumeReserves)
    newSnapshot.deltaVolumeReservesUSD = deltaBigDecimalArray(newSnapshot.cumulativeVolumeReservesUSD, priorSnapshot.cumulativeVolumeReservesUSD)
    newSnapshot.deltaVolumeUSD = newSnapshot.cumulativeVolumeUSD.minus(priorSnapshot.cumulativeVolumeUSD)
    newSnapshot.deltaDepositCount = newSnapshot.cumulativeDepositCount - priorSnapshot.cumulativeDepositCount
    newSnapshot.deltaWithdrawCount = newSnapshot.cumulativeWithdrawCount - priorSnapshot.cumulativeWithdrawCount
    newSnapshot.deltaSwapCount = newSnapshot.cumulativeSwapCount - priorSnapshot.cumulativeSwapCount
    newSnapshot.lastUpdateTimestamp = timestamp
    newSnapshot.lastUpdateBlockNumber = blockNumber
    newSnapshot.save()
}

export function loadOrCreateWellHourlySnapshot(wellAddress: Address, hourID: i32, timestamp: BigInt, blockNumber: BigInt): WellHourlySnapshot {
    let snapshot = WellHourlySnapshot.load(wellAddress.concatI32(hourID))
    if (snapshot == null) {
        let well = loadWell(wellAddress)
        snapshot = new WellHourlySnapshot(wellAddress.concatI32(hourID))
        snapshot.hour = hourID
        snapshot.well = wellAddress
        snapshot.lpTokenSupply = well.lpTokenSupply
        snapshot.totalLiquidityUSD = well.totalLiquidityUSD
        snapshot.cumulativeVolumeReserves = well.cumulativeVolumeReserves
        snapshot.cumulativeVolumeReservesUSD = well.cumulativeVolumeReservesUSD
        snapshot.cumulativeVolumeUSD = well.cumulativeVolumeUSD
        snapshot.cumulativeDepositCount = well.cumulativeDepositCount
        snapshot.cumulativeWithdrawCount = well.cumulativeWithdrawCount
        snapshot.cumulativeSwapCount = well.cumulativeSwapCount
        snapshot.deltalpTokenSupply = ZERO_BI
        snapshot.deltaLiquidityUSD = ZERO_BD
        snapshot.deltaVolumeReserves = emptyBigIntArray(well.tokens.length)
        snapshot.deltaVolumeReservesUSD = emptyBigDecimalArray(well.tokens.length)
        snapshot.deltaVolumeUSD = ZERO_BD
        snapshot.deltaDepositCount = 0
        snapshot.deltaWithdrawCount = 0
        snapshot.deltaSwapCount = 0 
        snapshot.lastUpdateTimestamp = timestamp
        snapshot.lastUpdateBlockNumber = blockNumber
        snapshot.save()
    }
    return snapshot as WellHourlySnapshot
}
