import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { dayFromTimestamp, hourFromTimestamp } from "../../../subgraph-core/utils/Dates";
import {
  deltaBigDecimalArray,
  deltaBigIntArray,
  emptyBigDecimalArray,
  getBigDecimalArrayTotal,
  toDecimal,
  ZERO_BI
} from "../../../subgraph-core/utils/Decimals";
import { loadOrCreateWellDailySnapshot, loadOrCreateWellHourlySnapshot, loadWell } from "../entities/Well";
import { getTokenDecimals, updateTokenUSD } from "./Token";
import { getProtocolToken } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "./constants/Version";
import { loadToken } from "../entities/Token";
import { WellHourlySnapshot } from "../../generated/schema";

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
  const beanToken = getProtocolToken(v(), blockNumber);
  updateTokenUSD(beanToken, blockNumber, BigDecimal.fromString("1"));
  let beanIndex = well.tokens.indexOf(beanToken);
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
