import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { BoreWellWellFunctionStruct } from "../../generated/Aquifer/Aquifer";
import { Well, WellDailySnapshot, WellFunction, WellHourlySnapshot } from "../../generated/schema";
import { ERC20 } from "../../generated/templates/Well/ERC20";
import { BEAN_ERC20 } from "../../../subgraph-core/utils/Constants";
import { dayFromTimestamp, hourFromTimestamp } from "../../../subgraph-core/utils/Dates";
import {
  deltaBigDecimalArray,
  deltaBigIntArray,
  emptyBigDecimalArray,
  emptyBigIntArray,
  getBigDecimalArrayTotal,
  toDecimal,
  ZERO_BD,
  ZERO_BI
} from "../../../subgraph-core/utils/Decimals";
import { getTokenDecimals, loadToken, updateTokenUSD } from "./Token";

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

export function updateWellReserves(wellAddress: Address, additiveAmounts: BigInt[], timestamp: BigInt, blockNumber: BigInt): void {
  let well = loadWell(wellAddress);
  let balances = well.reserves;

  for (let i = 0; i < balances.length; i++) {
    balances[i] = balances[i].plus(additiveAmounts[i]);
  }

  well.reserves = balances;
  well.lastUpdateTimestamp = timestamp;
  well.lastUpdateBlockNumber = blockNumber;
  well.save();
}

export function getCalculatedReserveUSDValues(tokens: Bytes[], reserves: BigInt[]): BigDecimal[] {
  let results = emptyBigDecimalArray(tokens.length);
  for (let i = 0; i < tokens.length; i++) {
    let token = loadToken(Address.fromBytes(tokens[i]));
    results[i] = toDecimal(reserves[i], token.decimals).times(token.lastPriceUSD);
  }
  return results;
}

export function updateWellLiquidityTokenBalance(wellAddress: Address, deltaAmount: BigInt, timestamp: BigInt, blockNumber: BigInt): void {
  let well = loadWell(wellAddress);
  well.lpTokenSupply = well.lpTokenSupply.plus(deltaAmount);
  well.lastUpdateTimestamp = timestamp;
  well.lastUpdateBlockNumber = blockNumber;
  well.save();
}

export function updateWellTokenUSDPrices(wellAddress: Address, blockNumber: BigInt): void {
  let well = loadWell(wellAddress);

  // Update the BEAN price first as it is the reference for other USD calculations
  updateTokenUSD(BEAN_ERC20, blockNumber, BigDecimal.fromString("1"));
  let beanIndex = well.tokens.indexOf(BEAN_ERC20);
  // Curretly only supporting USD values for Wells with BEAN as a token.
  if (beanIndex == -1) {
    return;
  }
  let currentBeans = toDecimal(well.reserves[beanIndex]);

  for (let i = 0; i < well.tokens.length; i++) {
    if (i == beanIndex) {
      continue;
    }
    let tokenAddress = Address.fromBytes(well.tokens[i]);
    if (well.reserves[i].gt(ZERO_BI)) {
      updateTokenUSD(tokenAddress, blockNumber, currentBeans.div(toDecimal(well.reserves[i], getTokenDecimals(tokenAddress))));
    }
  }

  well.reservesUSD = getCalculatedReserveUSDValues(well.tokens, well.reserves);
  well.totalLiquidityUSD = getBigDecimalArrayTotal(well.reservesUSD);
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

export function checkForSnapshot(wellAddress: Address, timestamp: BigInt, blockNumber: BigInt): void {
  // We check for the prior period snapshot and then take one if needed
  // Schedule the "day" to begin at 9am PT/12pm ET.
  // Future work could include properly adjusting this when DST occurs.
  let dayID = dayFromTimestamp(timestamp, 8 * 60 * 60) - 1;
  let hourID = hourFromTimestamp(timestamp) - 1;

  let well = loadWell(wellAddress);

  if (dayID > well.lastSnapshotDayID) {
    takeWellDailySnapshot(wellAddress, dayID, timestamp, blockNumber);
  }
  if (hourID > well.lastSnapshotHourID) {
    takeWellHourlySnapshot(wellAddress, hourID, timestamp, blockNumber);
  }
}

export function takeWellDailySnapshot(wellAddress: Address, dayID: i32, timestamp: BigInt, blockNumber: BigInt): void {
  let well = loadWell(wellAddress);

  if (well.lastSnapshotDayID == 0) {
    loadOrCreateWellDailySnapshot(wellAddress, dayID, timestamp, blockNumber);
    well.lastSnapshotDayID = dayID;
    well.save();
    return;
  }

  let priorDay = well.lastSnapshotDayID;
  well.lastSnapshotDayID = dayID;
  well.save();

  let priorSnapshot = loadOrCreateWellDailySnapshot(wellAddress, priorDay, timestamp, blockNumber);
  let newSnapshot = loadOrCreateWellDailySnapshot(wellAddress, well.lastSnapshotDayID, timestamp, blockNumber);

  newSnapshot.deltalpTokenSupply = newSnapshot.lpTokenSupply.minus(priorSnapshot.lpTokenSupply);
  newSnapshot.deltaLiquidityUSD = newSnapshot.totalLiquidityUSD.minus(priorSnapshot.totalLiquidityUSD);

  newSnapshot.deltaTradeVolumeReserves = deltaBigIntArray(
    newSnapshot.cumulativeTradeVolumeReserves,
    priorSnapshot.cumulativeTradeVolumeReserves
  );
  newSnapshot.deltaTradeVolumeReservesUSD = deltaBigDecimalArray(
    newSnapshot.cumulativeTradeVolumeReservesUSD,
    priorSnapshot.cumulativeTradeVolumeReservesUSD
  );
  newSnapshot.deltaTradeVolumeUSD = newSnapshot.cumulativeTradeVolumeUSD.minus(priorSnapshot.cumulativeTradeVolumeUSD);
  newSnapshot.deltaBiTradeVolumeReserves = deltaBigIntArray(
    newSnapshot.cumulativeBiTradeVolumeReserves,
    priorSnapshot.cumulativeBiTradeVolumeReserves
  );
  newSnapshot.deltaTransferVolumeReserves = deltaBigIntArray(
    newSnapshot.cumulativeTransferVolumeReserves,
    priorSnapshot.cumulativeTransferVolumeReserves
  );
  newSnapshot.deltaTransferVolumeReservesUSD = deltaBigDecimalArray(
    newSnapshot.cumulativeTransferVolumeReservesUSD,
    priorSnapshot.cumulativeTransferVolumeReservesUSD
  );
  newSnapshot.deltaTransferVolumeUSD = newSnapshot.cumulativeTransferVolumeUSD.minus(priorSnapshot.cumulativeTransferVolumeUSD);

  newSnapshot.deltaDepositCount = newSnapshot.cumulativeDepositCount - priorSnapshot.cumulativeDepositCount;
  newSnapshot.deltaWithdrawCount = newSnapshot.cumulativeWithdrawCount - priorSnapshot.cumulativeWithdrawCount;
  newSnapshot.deltaSwapCount = newSnapshot.cumulativeSwapCount - priorSnapshot.cumulativeSwapCount;
  newSnapshot.lastUpdateTimestamp = timestamp;
  newSnapshot.lastUpdateBlockNumber = blockNumber;
  newSnapshot.save();
}

export function loadOrCreateWellDailySnapshot(wellAddress: Address, dayID: i32, timestamp: BigInt, blockNumber: BigInt): WellDailySnapshot {
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
    snapshot.lastUpdateTimestamp = timestamp;
    snapshot.lastUpdateBlockNumber = blockNumber;
    snapshot.save();
  }
  return snapshot as WellDailySnapshot;
}

export function takeWellHourlySnapshot(wellAddress: Address, hourID: i32, timestamp: BigInt, blockNumber: BigInt): void {
  let well = loadWell(wellAddress);

  let priorHourID = well.lastSnapshotHourID;
  well.lastSnapshotHourID = hourID;
  well.save();

  let priorSnapshot = loadOrCreateWellHourlySnapshot(wellAddress, priorHourID, timestamp, blockNumber);
  let newSnapshot = loadOrCreateWellHourlySnapshot(wellAddress, hourID, timestamp, blockNumber);

  newSnapshot.deltalpTokenSupply = newSnapshot.lpTokenSupply.minus(priorSnapshot.lpTokenSupply);
  newSnapshot.deltaLiquidityUSD = newSnapshot.totalLiquidityUSD.minus(priorSnapshot.totalLiquidityUSD);

  newSnapshot.deltaTradeVolumeReserves = deltaBigIntArray(
    newSnapshot.cumulativeTradeVolumeReserves,
    priorSnapshot.cumulativeTradeVolumeReserves
  );
  newSnapshot.deltaTradeVolumeReservesUSD = deltaBigDecimalArray(
    newSnapshot.cumulativeTradeVolumeReservesUSD,
    priorSnapshot.cumulativeTradeVolumeReservesUSD
  );
  newSnapshot.deltaTradeVolumeUSD = newSnapshot.cumulativeTradeVolumeUSD.minus(priorSnapshot.cumulativeTradeVolumeUSD);
  newSnapshot.deltaBiTradeVolumeReserves = deltaBigIntArray(
    newSnapshot.cumulativeBiTradeVolumeReserves,
    priorSnapshot.cumulativeBiTradeVolumeReserves
  );
  newSnapshot.deltaTransferVolumeReserves = deltaBigIntArray(
    newSnapshot.cumulativeTransferVolumeReserves,
    priorSnapshot.cumulativeTransferVolumeReserves
  );
  newSnapshot.deltaTransferVolumeReservesUSD = deltaBigDecimalArray(
    newSnapshot.cumulativeTransferVolumeReservesUSD,
    priorSnapshot.cumulativeTransferVolumeReservesUSD
  );
  newSnapshot.deltaTransferVolumeUSD = newSnapshot.cumulativeTransferVolumeUSD.minus(priorSnapshot.cumulativeTransferVolumeUSD);

  newSnapshot.deltaDepositCount = newSnapshot.cumulativeDepositCount - priorSnapshot.cumulativeDepositCount;
  newSnapshot.deltaWithdrawCount = newSnapshot.cumulativeWithdrawCount - priorSnapshot.cumulativeWithdrawCount;
  newSnapshot.deltaSwapCount = newSnapshot.cumulativeSwapCount - priorSnapshot.cumulativeSwapCount;
  newSnapshot.lastUpdateTimestamp = timestamp;
  newSnapshot.lastUpdateBlockNumber = blockNumber;
  newSnapshot.save();

  // Update the rolling daily and weekly volumes by removing the oldest value.
  // Newer values for the latest hour were already added.
  let oldest24h = WellHourlySnapshot.load(wellAddress.concatI32(hourID - 24));
  let oldest7d = WellHourlySnapshot.load(wellAddress.concatI32(hourID - 168));
  if (oldest24h != null) {
    well.rollingDailyTradeVolumeReserves = deltaBigIntArray(well.rollingDailyTradeVolumeReserves, oldest24h.deltaTradeVolumeReserves);
    well.rollingDailyTradeVolumeReservesUSD = deltaBigDecimalArray(
      well.rollingDailyTradeVolumeReservesUSD,
      oldest24h.deltaTradeVolumeReservesUSD
    );
    well.rollingDailyTradeVolumeUSD = well.rollingDailyTradeVolumeUSD.minus(oldest24h.deltaTradeVolumeUSD);
    well.rollingDailyBiTradeVolumeReserves = deltaBigIntArray(well.rollingDailyBiTradeVolumeReserves, oldest24h.deltaBiTradeVolumeReserves);
    well.rollingDailyTransferVolumeReserves = deltaBigIntArray(
      well.rollingDailyTransferVolumeReserves,
      oldest24h.deltaTransferVolumeReserves
    );
    well.rollingDailyTransferVolumeReservesUSD = deltaBigDecimalArray(
      well.rollingDailyTransferVolumeReservesUSD,
      oldest24h.deltaTransferVolumeReservesUSD
    );
    well.rollingDailyTransferVolumeUSD = well.rollingDailyTransferVolumeUSD.minus(oldest24h.deltaTransferVolumeUSD);
    if (oldest7d != null) {
      well.rollingWeeklyTradeVolumeReserves = deltaBigIntArray(well.rollingWeeklyTradeVolumeReserves, oldest7d.deltaTradeVolumeReserves);
      well.rollingWeeklyTradeVolumeReservesUSD = deltaBigDecimalArray(
        well.rollingWeeklyTradeVolumeReservesUSD,
        oldest7d.deltaTradeVolumeReservesUSD
      );
      well.rollingWeeklyTradeVolumeUSD = well.rollingWeeklyTradeVolumeUSD.minus(oldest7d.deltaTradeVolumeUSD);
      well.rollingWeeklyBiTradeVolumeReserves = deltaBigIntArray(
        well.rollingWeeklyBiTradeVolumeReserves,
        oldest7d.deltaBiTradeVolumeReserves
      );
      well.rollingWeeklyTransferVolumeReserves = deltaBigIntArray(
        well.rollingWeeklyTransferVolumeReserves,
        oldest7d.deltaTransferVolumeReserves
      );
      well.rollingWeeklyTransferVolumeReservesUSD = deltaBigDecimalArray(
        well.rollingWeeklyTransferVolumeReservesUSD,
        oldest7d.deltaTransferVolumeReservesUSD
      );
      well.rollingWeeklyTransferVolumeUSD = well.rollingWeeklyTransferVolumeUSD.minus(oldest7d.deltaTransferVolumeUSD);
    }
  }
  well.save();
}

export function loadOrCreateWellHourlySnapshot(
  wellAddress: Address,
  hourID: i32,
  timestamp: BigInt,
  blockNumber: BigInt
): WellHourlySnapshot {
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
    snapshot.lastUpdateTimestamp = timestamp;
    snapshot.lastUpdateBlockNumber = blockNumber;
    snapshot.save();
  }
  return snapshot as WellHourlySnapshot;
}
