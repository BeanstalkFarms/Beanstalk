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
  let swapToken = loadToken(fromToken);

  let fromTokenIndex = well.tokens.indexOf(fromToken);
  let toTokenIndex = well.tokens.indexOf(toToken);

  let usdVolume = toDecimal(amountIn, swapToken.decimals).times(swapToken.lastPriceUSD);

  // Update fromToken amounts

  let volumeReserves = well.cumulativeVolumeReserves;
  let volumeReservesUSD = well.cumulativeVolumeReservesUSD;
  let reserves = well.reserves;

  volumeReserves[fromTokenIndex] = volumeReserves[fromTokenIndex].plus(amountIn);
  volumeReservesUSD[fromTokenIndex] = volumeReservesUSD[fromTokenIndex].plus(usdVolume);
  reserves[fromTokenIndex] = reserves[fromTokenIndex].plus(amountIn);

  reserves[toTokenIndex] = reserves[toTokenIndex].minus(amountOut);

  well.cumulativeVolumeUSD = well.cumulativeVolumeUSD.plus(usdVolume);
  well.cumulativeVolumeReserves = volumeReserves;
  well.cumulativeVolumeReservesUSD = volumeReservesUSD;
  well.reserves = reserves;

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
  let currentBeans = toDecimal(well.reserves[beanIndex]);

  for (let i = 0; i < well.tokens.length; i++) {
    if (i == beanIndex) continue;
    let tokenAddress = Address.fromBytes(well.tokens[i]);

    updateTokenUSD(tokenAddress, blockNumber, currentBeans.div(toDecimal(well.reserves[i], getTokenDecimals(tokenAddress))));
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
  let dayID = dayFromTimestamp(timestamp) - 1;
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
  let newSnapshot = loadOrCreateWellHourlySnapshot(wellAddress, well.lastSnapshotHourID, timestamp, blockNumber);

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
