import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Well, WellDailySnapshot, WellFunction, WellHourlySnapshot } from "../../generated/schema";
import { ERC20 } from "../../generated/Basin-ABIs/ERC20";
import { emptyBigDecimalArray, emptyBigIntArray, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { BoreWellWellFunctionStruct } from "../../generated/Basin-ABIs/Aquifer";

export function createWell(wellAddress: Address, implementation: Address, inputTokens: Address[]): Well {
  let well = Well.load(wellAddress);
  if (well !== null) {
    return well as Well;
  }

  well = new Well(wellAddress);

  let wellContract = ERC20.bind(wellAddress);

  let nameCall = wellContract.try_name();
  if (nameCall.reverted) {
    well.name = "";
  } else {
    well.name = nameCall.value;
  }

  let symbolCall = wellContract.try_symbol();
  if (symbolCall.reverted) {
    well.symbol = "";
  } else {
    well.symbol = symbolCall.value;
  }

  well.aquifer = Bytes.empty();
  well.implementation = implementation;
  well.tokens = []; // This is currently set in the `handleBoreWell` function
  well.tokenOrder = [];
  well.createdTimestamp = ZERO_BI;
  well.createdBlockNumber = ZERO_BI;
  well.lpTokenSupply = ZERO_BI;
  well.totalLiquidityUSD = ZERO_BD;
  well.reserves = emptyBigIntArray(inputTokens.length);
  well.reservesUSD = emptyBigDecimalArray(inputTokens.length);
  well.cumulativeTradeVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.cumulativeTradeVolumeReservesUSD = emptyBigDecimalArray(inputTokens.length);
  well.cumulativeTradeVolumeUSD = ZERO_BD;
  well.cumulativeBiTradeVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.cumulativeTransferVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.cumulativeTransferVolumeReservesUSD = emptyBigDecimalArray(inputTokens.length);
  well.cumulativeTransferVolumeUSD = ZERO_BD;
  well.cumulativeDepositCount = 0;
  well.cumulativeWithdrawCount = 0;
  well.cumulativeSwapCount = 0;
  well.rollingDailyTradeVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.rollingDailyTradeVolumeReservesUSD = emptyBigDecimalArray(inputTokens.length);
  well.rollingDailyTradeVolumeUSD = ZERO_BD;
  well.rollingDailyBiTradeVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.rollingDailyTransferVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.rollingDailyTransferVolumeReservesUSD = emptyBigDecimalArray(inputTokens.length);
  well.rollingDailyTransferVolumeUSD = ZERO_BD;
  well.rollingWeeklyTradeVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.rollingWeeklyTradeVolumeReservesUSD = emptyBigDecimalArray(inputTokens.length);
  well.rollingWeeklyTradeVolumeUSD = ZERO_BD;
  well.rollingWeeklyBiTradeVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.rollingWeeklyTransferVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.rollingWeeklyTransferVolumeReservesUSD = emptyBigDecimalArray(inputTokens.length);
  well.rollingWeeklyTransferVolumeUSD = ZERO_BD;
  well.lastSnapshotDayID = 0;
  well.lastSnapshotHourID = 0;
  well.lastUpdateTimestamp = ZERO_BI;
  well.lastUpdateBlockNumber = ZERO_BI;
  well.save();

  return well as Well;
}

export function loadWell(wellAddress: Address): Well {
  return Well.load(wellAddress) as Well;
}

export function loadOrCreateWellFunction(functionData: BoreWellWellFunctionStruct, wellAddress: Address): WellFunction {
  let id = wellAddress.toHexString() + "-" + functionData.target.toHexString();
  let wellFunction = WellFunction.load(id);
  if (wellFunction == null) {
    wellFunction = new WellFunction(id);
    wellFunction.target = functionData.target;
    wellFunction.data = functionData.data;
    wellFunction.well = wellAddress;
    wellFunction.save();
  }
  return wellFunction as WellFunction;
}

export function loadOrCreateWellDailySnapshot(wellAddress: Address, dayID: i32, block: ethereum.Block): WellDailySnapshot {
  let snapshot = WellDailySnapshot.load(wellAddress.concatI32(dayID));

  if (snapshot == null) {
    let well = loadWell(wellAddress);
    snapshot = new WellDailySnapshot(wellAddress.concatI32(dayID));
    snapshot.day = dayID;
    snapshot.well = wellAddress;
    snapshot.lpTokenSupply = well.lpTokenSupply;
    snapshot.totalLiquidityUSD = well.totalLiquidityUSD;
    snapshot.cumulativeTradeVolumeReserves = well.cumulativeTradeVolumeReserves;
    snapshot.cumulativeTradeVolumeReservesUSD = well.cumulativeTradeVolumeReservesUSD;
    snapshot.cumulativeTradeVolumeUSD = well.cumulativeTradeVolumeUSD;
    snapshot.cumulativeBiTradeVolumeReserves = well.cumulativeBiTradeVolumeReserves;
    snapshot.cumulativeTransferVolumeReserves = well.cumulativeTransferVolumeReserves;
    snapshot.cumulativeTransferVolumeReservesUSD = well.cumulativeTransferVolumeReservesUSD;
    snapshot.cumulativeTransferVolumeUSD = well.cumulativeTransferVolumeUSD;
    snapshot.cumulativeDepositCount = well.cumulativeDepositCount;
    snapshot.cumulativeWithdrawCount = well.cumulativeWithdrawCount;
    snapshot.cumulativeSwapCount = well.cumulativeSwapCount;
    snapshot.deltalpTokenSupply = ZERO_BI;
    snapshot.deltaLiquidityUSD = ZERO_BD;
    snapshot.deltaTradeVolumeReserves = emptyBigIntArray(well.tokens.length);
    snapshot.deltaTradeVolumeReservesUSD = emptyBigDecimalArray(well.tokens.length);
    snapshot.deltaTradeVolumeUSD = ZERO_BD;
    snapshot.deltaBiTradeVolumeReserves = emptyBigIntArray(well.tokens.length);
    snapshot.deltaTransferVolumeReserves = emptyBigIntArray(well.tokens.length);
    snapshot.deltaTransferVolumeReservesUSD = emptyBigDecimalArray(well.tokens.length);
    snapshot.deltaTransferVolumeUSD = ZERO_BD;
    snapshot.deltaDepositCount = 0;
    snapshot.deltaWithdrawCount = 0;
    snapshot.deltaSwapCount = 0;
    snapshot.lastUpdateTimestamp = block.timestamp;
    snapshot.lastUpdateBlockNumber = block.number;
    snapshot.save();
  }
  return snapshot as WellDailySnapshot;
}

export function loadOrCreateWellHourlySnapshot(wellAddress: Address, hourID: i32, block: ethereum.Block): WellHourlySnapshot {
  let snapshot = WellHourlySnapshot.load(wellAddress.concatI32(hourID));
  if (snapshot == null) {
    let well = loadWell(wellAddress);
    snapshot = new WellHourlySnapshot(wellAddress.concatI32(hourID));
    snapshot.hour = hourID;
    snapshot.well = wellAddress;
    snapshot.lpTokenSupply = well.lpTokenSupply;
    snapshot.totalLiquidityUSD = well.totalLiquidityUSD;
    snapshot.cumulativeTradeVolumeReserves = well.cumulativeTradeVolumeReserves;
    snapshot.cumulativeTradeVolumeReservesUSD = well.cumulativeTradeVolumeReservesUSD;
    snapshot.cumulativeTradeVolumeUSD = well.cumulativeTradeVolumeUSD;
    snapshot.cumulativeBiTradeVolumeReserves = well.cumulativeBiTradeVolumeReserves;
    snapshot.cumulativeTransferVolumeReserves = well.cumulativeTransferVolumeReserves;
    snapshot.cumulativeTransferVolumeReservesUSD = well.cumulativeTransferVolumeReservesUSD;
    snapshot.cumulativeTransferVolumeUSD = well.cumulativeTransferVolumeUSD;
    snapshot.cumulativeDepositCount = well.cumulativeDepositCount;
    snapshot.cumulativeWithdrawCount = well.cumulativeWithdrawCount;
    snapshot.cumulativeSwapCount = well.cumulativeSwapCount;
    snapshot.deltalpTokenSupply = ZERO_BI;
    snapshot.deltaLiquidityUSD = ZERO_BD;
    snapshot.deltaTradeVolumeReserves = emptyBigIntArray(well.tokens.length);
    snapshot.deltaTradeVolumeReservesUSD = emptyBigDecimalArray(well.tokens.length);
    snapshot.deltaTradeVolumeUSD = ZERO_BD;
    snapshot.deltaBiTradeVolumeReserves = emptyBigIntArray(well.tokens.length);
    snapshot.deltaTransferVolumeReserves = emptyBigIntArray(well.tokens.length);
    snapshot.deltaTransferVolumeReservesUSD = emptyBigDecimalArray(well.tokens.length);
    snapshot.deltaTransferVolumeUSD = ZERO_BD;
    snapshot.deltaDepositCount = 0;
    snapshot.deltaWithdrawCount = 0;
    snapshot.deltaSwapCount = 0;
    snapshot.lastUpdateTimestamp = block.timestamp;
    snapshot.lastUpdateBlockNumber = block.timestamp;
    snapshot.save();
  }
  return snapshot as WellHourlySnapshot;
}
