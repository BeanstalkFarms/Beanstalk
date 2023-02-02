import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { Well } from "../../generated/schema";
import { ADDRESS_ZERO } from "./Constants";
import { ZERO_BD, ZERO_BI } from "./Decimals";

export function createWell(wellAddress: Address, inputTokens: Address[]): Well {
    let well = Well.load(wellAddress)
    if (well !== null) { return well as Well }

    well = new Well(wellAddress)

    // Every well must be deployed with at least 2 tokens. Push additional if needed.
    let emptyBigIntArray = [ZERO_BI, ZERO_BI]
    let emptyBigDecimalArray = [ZERO_BD, ZERO_BD]

    for (let i = 2; i < inputTokens.length; i++) {
        emptyBigIntArray.push(ZERO_BI)
        emptyBigDecimalArray.push(ZERO_BD)
    }


    well.aquifer = Bytes.empty()
    well.inputTokens = [] // This is currently set in the `handleBoreWell` function
    well.wellFunction = ADDRESS_ZERO
    well.createdTimestamp = ZERO_BI
    well.createdBlockNumber = ZERO_BI
    well.totalLiquidity = ZERO_BI
    well.totalLiquidityUSD = ZERO_BD
    well.cumulativeVolumeTokenAmounts = emptyBigIntArray
    well.cumulativeVolumesUSD = emptyBigDecimalArray
    well.cumulativeVolumeUSD = ZERO_BD
    well.inputTokenBalances = emptyBigIntArray
    well.inputTokenBalancesUSD = emptyBigDecimalArray
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

export function incrementWellSwap(wellAddress: Address): void {
    let well = loadWell(wellAddress)
    well.cumulativeSwapCount += 1
    well.save()
}
