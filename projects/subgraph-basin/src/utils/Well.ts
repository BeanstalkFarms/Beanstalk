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
  if (nameCall.reverted) well.name = "";
  else well.name = nameCall.value;

  let symbolCall = wellContract.try_symbol();
  if (symbolCall.reverted) well.symbol = "";
  else well.symbol = symbolCall.value;

  well.aquifer = Bytes.empty();
  well.implementation = implementation;
  well.tokens = []; // This is currently set in the `handleBoreWell` function
  well.createdTimestamp = ZERO_BI;
  well.createdBlockNumber = ZERO_BI;
  well.lpTokenSupply = ZERO_BI;
  well.totalLiquidityUSD = ZERO_BD;
  well.reserves = emptyBigIntArray(inputTokens.length);
  well.reservesUSD = emptyBigDecimalArray(inputTokens.length);
  well.cumulativeVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.cumulativeVolumeReservesUSD = emptyBigDecimalArray(inputTokens.length);
  well.cumulativeVolumeUSD = ZERO_BD;
  well.cumulativeDepositCount = 0;
  well.cumulativeWithdrawCount = 0;
  well.cumulativeSwapCount = 0;
  well.rollingDailyVolumeUSD = ZERO_BD;
  well.rollingWeeklyVolumeUSD = ZERO_BD;
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

export function updateWellVolumes(
  wellAddress: Address,
  fromToken: Address,
  amountIn: BigInt,
  toToken: Address,
  amountOut: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let well = loadWell(wellAddress);
  let tokenFrom = loadToken(fromToken);
  let tokenTo = loadToken(toToken);

  let fromTokenIndex = well.tokens.indexOf(fromToken);
  let toTokenIndex = well.tokens.indexOf(toToken);

  let usdAmountIn = toDecimal(amountIn, tokenFrom.decimals).times(tokenFrom.lastPriceUSD);
  let usdAmountOut = toDecimal(amountOut, tokenTo.decimals).times(tokenTo.lastPriceUSD);

  let usdVolume = usdAmountIn.plus(usdAmountOut).div(BigDecimal.fromString("2"));
  well.cumulativeVolumeUSD = well.cumulativeVolumeUSD.plus(usdVolume);

  // Update swap volume by reserves
  // Volume is considered on both ends of the trade. This is particularly relevant since a well could have >2 tokens.
  let volumeReserves = well.cumulativeVolumeReserves;
  let volumeReservesUSD = well.cumulativeVolumeReservesUSD;
  volumeReserves[fromTokenIndex] = volumeReserves[fromTokenIndex].plus(amountIn);
  volumeReserves[toTokenIndex] = volumeReserves[toTokenIndex].plus(amountOut);
  volumeReservesUSD[fromTokenIndex] = volumeReservesUSD[fromTokenIndex].plus(usdAmountIn);
  volumeReservesUSD[toTokenIndex] = volumeReservesUSD[toTokenIndex].plus(usdAmountOut);

  let reserves = well.reserves;
  reserves[fromTokenIndex] = reserves[fromTokenIndex].plus(amountIn);
  reserves[toTokenIndex] = reserves[toTokenIndex].minus(amountOut);

  well.cumulativeVolumeReserves = volumeReserves;
  well.cumulativeVolumeReservesUSD = volumeReservesUSD;
  well.reserves = reserves;

  // Add to the rolling volumes. At the end of this hour, the furthest day back will have its volume amount removed.
  // As a result there is constantly between 24-25hrs of data here. This is preferable to not containing
  // some of the most recent volume data.
  well.rollingDailyVolumeUSD = well.rollingDailyVolumeUSD.plus(usdVolume);
  well.rollingWeeklyVolumeUSD = well.rollingWeeklyVolumeUSD.plus(usdVolume);

  well.lastUpdateTimestamp = timestamp;
  well.lastUpdateBlockNumber = blockNumber;

  well.save();
}

export function updateWellTokenBalances(wellAddress: Address, inputTokenAmounts: BigInt[], timestamp: BigInt, blockNumber: BigInt): void {
  let well = loadWell(wellAddress);
  let balances = well.reserves;

  for (let i = 0; i < balances.length; i++) {
    balances[i] = balances[i].plus(inputTokenAmounts[i]);
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
  if (beanIndex == -1) return;
  let currentBeans = toDecimal(well.reserves[beanIndex]);

  for (let i = 0; i < well.tokens.length; i++) {
    if (i == beanIndex) continue;
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

  if (dayID > well.lastSnapshotDayID) takeWellDailySnapshot(wellAddress, dayID, timestamp, blockNumber);
  if (hourID > well.lastSnapshotHourID) takeWellHourlySnapshot(wellAddress, hourID, timestamp, blockNumber);
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
  newSnapshot.deltaVolumeReserves = deltaBigIntArray(newSnapshot.cumulativeVolumeReserves, priorSnapshot.cumulativeVolumeReserves);
  newSnapshot.deltaVolumeReservesUSD = deltaBigDecimalArray(
    newSnapshot.cumulativeVolumeReservesUSD,
    priorSnapshot.cumulativeVolumeReservesUSD
  );
  newSnapshot.deltaVolumeUSD = newSnapshot.cumulativeVolumeUSD.minus(priorSnapshot.cumulativeVolumeUSD);
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
    snapshot.cumulativeVolumeReserves = well.cumulativeVolumeReserves;
    snapshot.cumulativeVolumeReservesUSD = well.cumulativeVolumeReservesUSD;
    snapshot.cumulativeVolumeUSD = well.cumulativeVolumeUSD;
    snapshot.cumulativeDepositCount = well.cumulativeDepositCount;
    snapshot.cumulativeWithdrawCount = well.cumulativeWithdrawCount;
    snapshot.cumulativeSwapCount = well.cumulativeSwapCount;
    snapshot.deltalpTokenSupply = ZERO_BI;
    snapshot.deltaLiquidityUSD = ZERO_BD;
    snapshot.deltaVolumeReserves = emptyBigIntArray(well.tokens.length);
    snapshot.deltaVolumeReservesUSD = emptyBigDecimalArray(well.tokens.length);
    snapshot.deltaVolumeUSD = ZERO_BD;
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
  newSnapshot.deltaVolumeReserves = deltaBigIntArray(newSnapshot.cumulativeVolumeReserves, priorSnapshot.cumulativeVolumeReserves);
  newSnapshot.deltaVolumeReservesUSD = deltaBigDecimalArray(
    newSnapshot.cumulativeVolumeReservesUSD,
    priorSnapshot.cumulativeVolumeReservesUSD
  );
  newSnapshot.deltaVolumeUSD = newSnapshot.cumulativeVolumeUSD.minus(priorSnapshot.cumulativeVolumeUSD);
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
    well.rollingDailyVolumeUSD = well.rollingDailyVolumeUSD.minus(oldest24h.deltaVolumeUSD);
    if (oldest7d != null) {
      well.rollingWeeklyVolumeUSD = well.rollingWeeklyVolumeUSD.minus(oldest7d.deltaVolumeUSD);
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
    snapshot.cumulativeVolumeReserves = well.cumulativeVolumeReserves;
    snapshot.cumulativeVolumeReservesUSD = well.cumulativeVolumeReservesUSD;
    snapshot.cumulativeVolumeUSD = well.cumulativeVolumeUSD;
    snapshot.cumulativeDepositCount = well.cumulativeDepositCount;
    snapshot.cumulativeWithdrawCount = well.cumulativeWithdrawCount;
    snapshot.cumulativeSwapCount = well.cumulativeSwapCount;
    snapshot.deltalpTokenSupply = ZERO_BI;
    snapshot.deltaLiquidityUSD = ZERO_BD;
    snapshot.deltaVolumeReserves = emptyBigIntArray(well.tokens.length);
    snapshot.deltaVolumeReservesUSD = emptyBigDecimalArray(well.tokens.length);
    snapshot.deltaVolumeUSD = ZERO_BD;
    snapshot.deltaDepositCount = 0;
    snapshot.deltaWithdrawCount = 0;
    snapshot.deltaSwapCount = 0;
    snapshot.lastUpdateTimestamp = timestamp;
    snapshot.lastUpdateBlockNumber = blockNumber;
    snapshot.save();
  }
  return snapshot as WellHourlySnapshot;
}
