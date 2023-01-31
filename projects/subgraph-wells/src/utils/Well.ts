import { Address, Bytes } from "@graphprotocol/graph-ts";
import { Well } from "../../generated/schema";
import { ADDRESS_ZERO } from "./Constants";
import { ZERO_BD, ZERO_BI } from "./Decimals";

export function loadOrCreateWell(wellAddress: Address): Well {
    let well = Well.load(wellAddress)
    if (well == null) {
        well = new Well(wellAddress)
        well.aquifer = Bytes.empty()
        well.inputTokens = []
        well.wellFunction = ADDRESS_ZERO
        well.createdTimestamp = ZERO_BI
        well.createdBlockNumber = ZERO_BI
        well.totalLiquidity = ZERO_BI
        well.totalLiquidityUSD = ZERO_BD
        well.cumulativeVolumeTokenAmounts = []
        well.cumulativeVolumesUSD = []
        well.cumulativeVolumeUSD = ZERO_BD
        well.inputTokenBalances = []
        well.inputTokenBalancesUSD = []
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
    }
    return well as Well
}
