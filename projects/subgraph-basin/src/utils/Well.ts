import { Address, BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { BoreWellWellFunctionStruct } from "../../generated/Aquifer/Aquifer";
import { Token, Well, WellDailySnapshot, WellFunction, WellHourlySnapshot } from "../../generated/schema";
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
import { BigDecimal_max, BigDecimal_min, BigDecimal_sum } from "../../../subgraph-core/utils/ArrayMath";

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
  well.cumulativeTransferVolumeReserves = emptyBigIntArray(inputTokens.length);
  well.cumulativeTransferVolumeReservesUSD = emptyBigDecimalArray(inputTokens.length);
  well.cumulativeTransferVolumeUSD = ZERO_BD;
  well.cumulativeDepositCount = 0;
  well.cumulativeWithdrawCount = 0;
  well.cumulativeSwapCount = 0;
  well.rollingDailyTradeVolumeUSD = ZERO_BD;
  well.rollingDailyTransferVolumeUSD = ZERO_BD;
  well.rollingWeeklyTradeVolumeUSD = ZERO_BD;
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

export function updateWellVolumesAfterSwap(
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

  // let usdVolume = usdAmountIn.plus(usdAmountOut).div(BigDecimal.fromString("2"));
  well.cumulativeTradeVolumeUSD = well.cumulativeTradeVolumeUSD.plus(usdAmountOut);
  well.cumulativeTransferVolumeUSD = well.cumulativeTransferVolumeUSD.plus(usdAmountIn).plus(usdAmountOut);

  // Update swap volume by reserves. Trade volume is considered on the buying end of the trade, while
  // Transfer volume is considered on both ends of the trade.
  let tradeVolumeReserves = well.cumulativeTradeVolumeReserves;
  let tradeVolumeReservesUSD = well.cumulativeTradeVolumeReservesUSD;
  let transferVolumeReserves = well.cumulativeTransferVolumeReserves;
  let transferVolumeReservesUSD = well.cumulativeTransferVolumeReservesUSD;
  tradeVolumeReserves[toTokenIndex] = tradeVolumeReserves[toTokenIndex].plus(amountOut);
  tradeVolumeReservesUSD[toTokenIndex] = tradeVolumeReservesUSD[toTokenIndex].plus(usdAmountOut);
  transferVolumeReserves[fromTokenIndex] = transferVolumeReserves[fromTokenIndex].plus(amountIn);
  transferVolumeReserves[toTokenIndex] = transferVolumeReserves[toTokenIndex].plus(amountOut);
  transferVolumeReservesUSD[fromTokenIndex] = transferVolumeReservesUSD[fromTokenIndex].plus(usdAmountIn);
  transferVolumeReservesUSD[toTokenIndex] = transferVolumeReservesUSD[toTokenIndex].plus(usdAmountOut);

  well.cumulativeTradeVolumeReserves = tradeVolumeReserves;
  well.cumulativeTradeVolumeReservesUSD = tradeVolumeReservesUSD;
  well.cumulativeTransferVolumeReserves = transferVolumeReserves;
  well.cumulativeTransferVolumeReservesUSD = transferVolumeReservesUSD;

  // Add to the rolling volumes. At the end of this hour, the furthest day back will have its volume amount removed.
  // As a result there is constantly between 24-25hrs of data here. This is preferable to not containing
  // some of the most recent volume data.
  well.rollingDailyTradeVolumeUSD = well.rollingDailyTradeVolumeUSD.plus(usdAmountOut);
  well.rollingDailyTransferVolumeUSD = well.rollingDailyTransferVolumeUSD.plus(usdAmountIn).plus(usdAmountOut);
  well.rollingWeeklyTradeVolumeUSD = well.rollingWeeklyTradeVolumeUSD.plus(usdAmountOut);
  well.rollingWeeklyTransferVolumeUSD = well.rollingWeeklyTransferVolumeUSD.plus(usdAmountIn).plus(usdAmountOut);

  well.lastUpdateTimestamp = timestamp;
  well.lastUpdateBlockNumber = blockNumber;

  well.save();
}

// The current implementation of USD volumes may be incorrect for wells that have more than 2 tokens.
export function updateWellVolumesAfterLiquidity(
  wellAddress: Address,
  tokens: Address[],
  amounts: BigInt[],
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let well = loadWell(wellAddress);
  const tokenInfos = tokens.map<Token>((t) => loadToken(t));

  const usdAmounts: BigDecimal[] = [];
  for (let i = 0; i < tokens.length; ++i) {
    const tokenIndex = well.tokens.indexOf(tokens[i]);
    const tokenInfo = tokenInfos[i];
    const usdAmount = toDecimal(amounts[i].abs(), tokenInfo.decimals).times(tokenInfo.lastPriceUSD);
    usdAmounts.push(usdAmount);

    // Update swap volume for individual reserves. Trade volume is not known yet.
    // Transfer volume is considered on both ends of the trade.
    let transferVolumeReserves = well.cumulativeTransferVolumeReserves;
    let transferVolumeReservesUSD = well.cumulativeTransferVolumeReservesUSD;
    transferVolumeReserves[tokenIndex] = transferVolumeReserves[tokenIndex].plus(amounts[i].abs());
    transferVolumeReservesUSD[tokenIndex] = transferVolumeReservesUSD[tokenIndex].plus(usdAmount);
    well.cumulativeTransferVolumeReserves = transferVolumeReserves;
    well.cumulativeTransferVolumeReservesUSD = transferVolumeReservesUSD;
  }

  // Update cumulative usd volume. Trade volume is determined based on the amount of price fluctuation
  // caused by the liquidity event.
  let minAmount = tokens.length == well.tokens.length ? BigDecimal_min(usdAmounts) : ZERO_BD;
  let usdVolume = BigDecimal_max(usdAmounts).minus(minAmount).div(BigDecimal.fromString(well.tokens.length.toString()));
  let cumulativeTransfer = BigDecimal_sum(usdAmounts);
  well.cumulativeTradeVolumeUSD = well.cumulativeTradeVolumeUSD.plus(usdVolume);
  well.cumulativeTransferVolumeUSD = well.cumulativeTransferVolumeUSD.plus(cumulativeTransfer);

  // TODO
  // Determine which token is bought and increment its trade volume. Example:
  // Adding beans = selling bean/buying weth
  // Removing beans = buying beans/selling weth
  // => the token that there is fewest of is being bought.
  // The amount being bought can be computed as usdVolume/price.

  // Add to the rolling volumes. At the end of this hour, the furthest day back will have its volume amount removed.
  // As a result there is constantly between 24-25hrs of data here. This is preferable to not containing
  // some of the most recent volume data.
  well.rollingDailyTradeVolumeUSD = well.rollingDailyTradeVolumeUSD.plus(usdVolume);
  well.rollingDailyTransferVolumeUSD = well.rollingDailyTransferVolumeUSD.plus(cumulativeTransfer);
  well.rollingWeeklyTradeVolumeUSD = well.rollingWeeklyTradeVolumeUSD.plus(usdVolume);
  well.rollingWeeklyTransferVolumeUSD = well.rollingWeeklyTransferVolumeUSD.plus(cumulativeTransfer);

  well.lastUpdateTimestamp = timestamp;
  well.lastUpdateBlockNumber = blockNumber;

  well.save();
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
    well.rollingDailyTradeVolumeUSD = well.rollingDailyTradeVolumeUSD.minus(oldest24h.deltaTradeVolumeUSD);
    well.rollingDailyTransferVolumeUSD = well.rollingDailyTransferVolumeUSD.minus(oldest24h.deltaTransferVolumeUSD);
    if (oldest7d != null) {
      well.rollingWeeklyTradeVolumeUSD = well.rollingWeeklyTradeVolumeUSD.minus(oldest7d.deltaTradeVolumeUSD);
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
