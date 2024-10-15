import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { Well, WellDailySnapshot, WellHourlySnapshot } from "../../generated/schema";
import { ERC20 } from "../../generated/Basin-ABIs/ERC20";
import {
  subBigDecimalArray,
  subBigIntArray,
  emptyBigDecimalArray,
  emptyBigIntArray,
  ZERO_BD,
  ZERO_BI
} from "../../../subgraph-core/utils/Decimals";

export function loadOrCreateWell(wellAddress: Address, inputTokens: Address[], block: ethereum.Block): Well {
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

  well.boredWell = Bytes.empty();
  well.aquifer = Bytes.empty();
  well.implementation = Bytes.empty();
  well.pumps = [];
  well.pumpData = [];
  well.wellFunction = Bytes.empty();
  well.wellFunctionData = Bytes.empty();
  well.tokens = [];
  well.tokenOrder = [];
  well.createdTimestamp = block.timestamp;
  well.createdBlockNumber = block.number;
  well.lpTokenSupply = ZERO_BI;
  well.totalLiquidityUSD = ZERO_BD;
  well.tokenPrice = [ZERO_BI, ZERO_BI];
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

export function loadOrCreateWellDailySnapshot(wellAddress: Address, dayID: i32, block: ethereum.Block): WellDailySnapshot {
  let snapshot = WellDailySnapshot.load(wellAddress.concatI32(dayID));

  if (snapshot == null) {
    let well = loadWell(wellAddress);
    snapshot = new WellDailySnapshot(wellAddress.concatI32(dayID));
    snapshot.day = dayID;
    snapshot.well = wellAddress;
    snapshot.lpTokenSupply = well.lpTokenSupply;
    snapshot.totalLiquidityUSD = well.totalLiquidityUSD;
    snapshot.tokenPrice = well.tokenPrice;
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
    snapshot.tokenPrice = well.tokenPrice;
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

export function updateWellReserves(wellAddress: Address, additiveAmounts: BigInt[], block: ethereum.Block): void {
  let well = loadWell(wellAddress);
  let balances = well.reserves;

  for (let i = 0; i < balances.length; i++) {
    balances[i] = balances[i].plus(additiveAmounts[i]);
  }

  well.reserves = balances;
  well.lastUpdateTimestamp = block.timestamp;
  well.lastUpdateBlockNumber = block.number;
  well.save();
}

export function updateWellLiquidityTokenBalance(wellAddress: Address, deltaAmount: BigInt, block: ethereum.Block): void {
  let well = loadWell(wellAddress);
  well.lpTokenSupply = well.lpTokenSupply.plus(deltaAmount);
  well.lastUpdateTimestamp = block.timestamp;
  well.lastUpdateBlockNumber = block.number;
  well.save();
}

export function incrementWellSwap(wellAddress: Address): void {
  let well = loadWell(wellAddress);
  well.cumulativeSwapCount += 1;
  well.save();
}

export function incrementWellDeposit(wellAddress: Address): void {
  let well = loadWell(wellAddress);
  well.cumulativeDepositCount += 1;
  well.save();
}

export function incrementWellWithdraw(wellAddress: Address): void {
  let well = loadWell(wellAddress);
  well.cumulativeWithdrawCount += 1;
  well.save();
}

export function takeWellDailySnapshot(wellAddress: Address, dayID: i32, block: ethereum.Block): void {
  let well = loadWell(wellAddress);

  if (well.lastSnapshotDayID == 0) {
    loadOrCreateWellDailySnapshot(wellAddress, dayID, block);
    well.lastSnapshotDayID = dayID;
    well.save();
    return;
  }

  let priorDay = well.lastSnapshotDayID;
  well.lastSnapshotDayID = dayID;
  well.save();

  let priorSnapshot = loadOrCreateWellDailySnapshot(wellAddress, priorDay, block);
  let newSnapshot = loadOrCreateWellDailySnapshot(wellAddress, well.lastSnapshotDayID, block);

  newSnapshot.deltalpTokenSupply = newSnapshot.lpTokenSupply.minus(priorSnapshot.lpTokenSupply);
  newSnapshot.deltaLiquidityUSD = newSnapshot.totalLiquidityUSD.minus(priorSnapshot.totalLiquidityUSD);

  newSnapshot.deltaTradeVolumeReserves = subBigIntArray(
    newSnapshot.cumulativeTradeVolumeReserves,
    priorSnapshot.cumulativeTradeVolumeReserves
  );
  newSnapshot.deltaTradeVolumeReservesUSD = subBigDecimalArray(
    newSnapshot.cumulativeTradeVolumeReservesUSD,
    priorSnapshot.cumulativeTradeVolumeReservesUSD
  );
  newSnapshot.deltaTradeVolumeUSD = newSnapshot.cumulativeTradeVolumeUSD.minus(priorSnapshot.cumulativeTradeVolumeUSD);
  newSnapshot.deltaBiTradeVolumeReserves = subBigIntArray(
    newSnapshot.cumulativeBiTradeVolumeReserves,
    priorSnapshot.cumulativeBiTradeVolumeReserves
  );
  newSnapshot.deltaTransferVolumeReserves = subBigIntArray(
    newSnapshot.cumulativeTransferVolumeReserves,
    priorSnapshot.cumulativeTransferVolumeReserves
  );
  newSnapshot.deltaTransferVolumeReservesUSD = subBigDecimalArray(
    newSnapshot.cumulativeTransferVolumeReservesUSD,
    priorSnapshot.cumulativeTransferVolumeReservesUSD
  );
  newSnapshot.deltaTransferVolumeUSD = newSnapshot.cumulativeTransferVolumeUSD.minus(priorSnapshot.cumulativeTransferVolumeUSD);

  newSnapshot.deltaDepositCount = newSnapshot.cumulativeDepositCount - priorSnapshot.cumulativeDepositCount;
  newSnapshot.deltaWithdrawCount = newSnapshot.cumulativeWithdrawCount - priorSnapshot.cumulativeWithdrawCount;
  newSnapshot.deltaSwapCount = newSnapshot.cumulativeSwapCount - priorSnapshot.cumulativeSwapCount;
  newSnapshot.lastUpdateTimestamp = block.timestamp;
  newSnapshot.lastUpdateBlockNumber = block.number;
  newSnapshot.save();
}

export function takeWellHourlySnapshot(wellAddress: Address, hourID: i32, block: ethereum.Block): void {
  let well = loadWell(wellAddress);

  let priorHourID = well.lastSnapshotHourID;
  well.lastSnapshotHourID = hourID;
  well.save();

  let priorSnapshot = loadOrCreateWellHourlySnapshot(wellAddress, priorHourID, block);
  let newSnapshot = loadOrCreateWellHourlySnapshot(wellAddress, hourID, block);

  newSnapshot.deltalpTokenSupply = newSnapshot.lpTokenSupply.minus(priorSnapshot.lpTokenSupply);
  newSnapshot.deltaLiquidityUSD = newSnapshot.totalLiquidityUSD.minus(priorSnapshot.totalLiquidityUSD);

  newSnapshot.deltaTradeVolumeReserves = subBigIntArray(
    newSnapshot.cumulativeTradeVolumeReserves,
    priorSnapshot.cumulativeTradeVolumeReserves
  );
  newSnapshot.deltaTradeVolumeReservesUSD = subBigDecimalArray(
    newSnapshot.cumulativeTradeVolumeReservesUSD,
    priorSnapshot.cumulativeTradeVolumeReservesUSD
  );
  newSnapshot.deltaTradeVolumeUSD = newSnapshot.cumulativeTradeVolumeUSD.minus(priorSnapshot.cumulativeTradeVolumeUSD);
  newSnapshot.deltaBiTradeVolumeReserves = subBigIntArray(
    newSnapshot.cumulativeBiTradeVolumeReserves,
    priorSnapshot.cumulativeBiTradeVolumeReserves
  );
  newSnapshot.deltaTransferVolumeReserves = subBigIntArray(
    newSnapshot.cumulativeTransferVolumeReserves,
    priorSnapshot.cumulativeTransferVolumeReserves
  );
  newSnapshot.deltaTransferVolumeReservesUSD = subBigDecimalArray(
    newSnapshot.cumulativeTransferVolumeReservesUSD,
    priorSnapshot.cumulativeTransferVolumeReservesUSD
  );
  newSnapshot.deltaTransferVolumeUSD = newSnapshot.cumulativeTransferVolumeUSD.minus(priorSnapshot.cumulativeTransferVolumeUSD);

  newSnapshot.deltaDepositCount = newSnapshot.cumulativeDepositCount - priorSnapshot.cumulativeDepositCount;
  newSnapshot.deltaWithdrawCount = newSnapshot.cumulativeWithdrawCount - priorSnapshot.cumulativeWithdrawCount;
  newSnapshot.deltaSwapCount = newSnapshot.cumulativeSwapCount - priorSnapshot.cumulativeSwapCount;
  newSnapshot.lastUpdateTimestamp = block.timestamp;
  newSnapshot.lastUpdateBlockNumber = block.number;
  newSnapshot.save();

  // Update the rolling daily and weekly volumes by removing the oldest value.
  // Newer values for the latest hour were already added.
  let oldest24h = WellHourlySnapshot.load(wellAddress.concatI32(hourID - 24));
  let oldest7d = WellHourlySnapshot.load(wellAddress.concatI32(hourID - 168));
  if (oldest24h != null) {
    well.rollingDailyTradeVolumeReserves = subBigIntArray(well.rollingDailyTradeVolumeReserves, oldest24h.deltaTradeVolumeReserves);
    well.rollingDailyTradeVolumeReservesUSD = subBigDecimalArray(
      well.rollingDailyTradeVolumeReservesUSD,
      oldest24h.deltaTradeVolumeReservesUSD
    );
    well.rollingDailyTradeVolumeUSD = well.rollingDailyTradeVolumeUSD.minus(oldest24h.deltaTradeVolumeUSD);
    well.rollingDailyBiTradeVolumeReserves = subBigIntArray(well.rollingDailyBiTradeVolumeReserves, oldest24h.deltaBiTradeVolumeReserves);
    well.rollingDailyTransferVolumeReserves = subBigIntArray(
      well.rollingDailyTransferVolumeReserves,
      oldest24h.deltaTransferVolumeReserves
    );
    well.rollingDailyTransferVolumeReservesUSD = subBigDecimalArray(
      well.rollingDailyTransferVolumeReservesUSD,
      oldest24h.deltaTransferVolumeReservesUSD
    );
    well.rollingDailyTransferVolumeUSD = well.rollingDailyTransferVolumeUSD.minus(oldest24h.deltaTransferVolumeUSD);
    if (oldest7d != null) {
      well.rollingWeeklyTradeVolumeReserves = subBigIntArray(well.rollingWeeklyTradeVolumeReserves, oldest7d.deltaTradeVolumeReserves);
      well.rollingWeeklyTradeVolumeReservesUSD = subBigDecimalArray(
        well.rollingWeeklyTradeVolumeReservesUSD,
        oldest7d.deltaTradeVolumeReservesUSD
      );
      well.rollingWeeklyTradeVolumeUSD = well.rollingWeeklyTradeVolumeUSD.minus(oldest7d.deltaTradeVolumeUSD);
      well.rollingWeeklyBiTradeVolumeReserves = subBigIntArray(
        well.rollingWeeklyBiTradeVolumeReserves,
        oldest7d.deltaBiTradeVolumeReserves
      );
      well.rollingWeeklyTransferVolumeReserves = subBigIntArray(
        well.rollingWeeklyTransferVolumeReserves,
        oldest7d.deltaTransferVolumeReserves
      );
      well.rollingWeeklyTransferVolumeReservesUSD = subBigDecimalArray(
        well.rollingWeeklyTransferVolumeReservesUSD,
        oldest7d.deltaTransferVolumeReservesUSD
      );
      well.rollingWeeklyTransferVolumeUSD = well.rollingWeeklyTransferVolumeUSD.minus(oldest7d.deltaTransferVolumeUSD);
    }
  }
  well.save();
}
