import { Address, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { emptyBigIntArray, toDecimal, ZERO_BD, ZERO_BI, subBigIntArray } from "../../../subgraph-core/utils/Decimals";
import { Well } from "../../generated/schema";
import { loadOrCreateWellFunction, loadWell } from "../entities/Well";
import { loadToken } from "../entities/Token";
import { WellFunction } from "../../generated/Basin-ABIs/WellFunction";
import { toAddress } from "../../../subgraph-core/utils/Bytes";

// Constant product volume calculations

export function updateWellVolumesAfterSwap(
  wellAddress: Address,
  fromToken: Address,
  amountIn: BigInt,
  toToken: Address,
  amountOut: BigInt,
  block: ethereum.Block
): void {
  let well = loadWell(wellAddress);

  const deltaTradeVolumeReserves = emptyBigIntArray(well.tokens.length);
  const deltaTransferVolumeReserves = emptyBigIntArray(well.tokens.length);

  // Trade volume is will ignore the selling end (negative)
  deltaTradeVolumeReserves[well.tokens.indexOf(fromToken)] = amountIn.neg();
  deltaTradeVolumeReserves[well.tokens.indexOf(toToken)] = amountOut;
  // Transfer volume is considered on both ends of the trade
  deltaTransferVolumeReserves[well.tokens.indexOf(fromToken)] = amountIn;
  deltaTransferVolumeReserves[well.tokens.indexOf(toToken)] = amountOut;

  updateVolumeStats(well, deltaTradeVolumeReserves, deltaTransferVolumeReserves);

  well.lastUpdateTimestamp = block.timestamp;
  well.lastUpdateBlockNumber = block.number;

  well.save();
}

// The current implementation of USD volumes may be incorrect for wells that have more than 2 tokens.
export function updateWellVolumesAfterLiquidity(
  wellAddress: Address,
  tokens: Address[],
  amounts: BigInt[],
  deltaLpSupply: BigInt,
  block: ethereum.Block
): void {
  let well = loadWell(wellAddress);
  const wellTokens = well.tokens.map<Address>((t) => toAddress(t));

  // Determines which tokens were bough/sold and how much
  const tradeAmount = calcLiquidityVolume(well, padTokenAmounts(wellTokens, tokens, amounts), deltaLpSupply);
  const deltaTransferVolumeReserves = padTokenAmounts(wellTokens, tokens, amounts);

  updateVolumeStats(well, tradeAmount, deltaTransferVolumeReserves);

  well.lastUpdateTimestamp = block.timestamp;
  well.lastUpdateBlockNumber = block.number;

  well.save();
}

/**
 * Calculates the token volume resulting from a liquidity add/remove operation.
 * The reserves corresponding to the amount of new lp tokens are compared with deltaReserves,
 * the difference is the amount of trading volume. In a proportional liquidity add, the values will be identical.
 * @param well - The Well entity, which has already updated its reserves and lp supply to the new values
 * @param deltaReserves - the change in reserves from the liquidity operation
 * @param deltaLpSupply - the change in lp token supply from the liquidity operation
 * @returns a list of tokens and the amount bought of each. the purchased token is positive, the sold token negative.
 */
export function calcLiquidityVolume(well: Well, deltaReserves: BigInt[], deltaLpSupply: BigInt): BigInt[] {
  if (well.lpTokenSupply == ZERO_BI) {
    return emptyBigIntArray(well.reserves.length);
  }
  const wellFn = loadOrCreateWellFunction(toAddress(well.wellFunction));
  const wellFnContract = WellFunction.bind(toAddress(wellFn.id));

  let tokenAmountBought: BigInt[];
  if (deltaLpSupply.gt(ZERO_BI)) {
    const doubleSided = wellFnContract.calcLPTokenUnderlying(deltaLpSupply.abs(), well.reserves, well.lpTokenSupply, wellFn.data);
    tokenAmountBought = [doubleSided[0].minus(deltaReserves[0]), doubleSided[1].minus(deltaReserves[1])];
  } else {
    const prevReserves = subBigIntArray(well.reserves, deltaReserves);
    const prevLpSupply = well.lpTokenSupply.minus(deltaLpSupply);
    const doubleSided = wellFnContract.calcLPTokenUnderlying(deltaLpSupply.abs(), prevReserves, prevLpSupply, wellFn.data);
    tokenAmountBought = [deltaReserves[0].abs().minus(doubleSided[0]), deltaReserves[1].abs().minus(doubleSided[1])];
  }
  return tokenAmountBought;
}

// Updates all volume statistics associated with this well using the provided values
function updateVolumeStats(well: Well, deltaTradeVolumeReserves: BigInt[], deltaTransferVolumeReserves: BigInt[]): void {
  let tradeVolumeReserves = well.cumulativeTradeVolumeReserves;
  let tradeVolumeReservesUSD = well.cumulativeTradeVolumeReservesUSD;
  let biTradeVolumeReserves = well.cumulativeBiTradeVolumeReserves;
  let rollingDailyTradeVolumeReserves = well.rollingDailyTradeVolumeReserves;
  let rollingDailyTradeVolumeReservesUSD = well.rollingDailyTradeVolumeReservesUSD;
  let rollingDailyBiTradeVolumeReserves = well.rollingDailyBiTradeVolumeReserves;
  let rollingWeeklyTradeVolumeReserves = well.rollingWeeklyTradeVolumeReserves;
  let rollingWeeklyTradeVolumeReservesUSD = well.rollingWeeklyTradeVolumeReservesUSD;
  let rollingWeeklyBiTradeVolumeReserves = well.rollingWeeklyBiTradeVolumeReserves;

  let transferVolumeReserves = well.cumulativeTransferVolumeReserves;
  let transferVolumeReservesUSD = well.cumulativeTransferVolumeReservesUSD;
  let rollingDailyTransferVolumeReserves = well.rollingDailyTransferVolumeReserves;
  let rollingDailyTransferVolumeReservesUSD = well.rollingDailyTransferVolumeReservesUSD;
  let rollingWeeklyTransferVolumeReserves = well.rollingWeeklyTransferVolumeReserves;
  let rollingWeeklyTransferVolumeReservesUSD = well.rollingWeeklyTransferVolumeReservesUSD;

  let totalTradeUSD = ZERO_BD;
  let totalTransferUSD = ZERO_BD;
  for (let i = 0; i < deltaTradeVolumeReserves.length; ++i) {
    const tokenInfo = loadToken(toAddress(well.tokens[i]));
    let usdTradeAmount = ZERO_BD;
    if (deltaTradeVolumeReserves[i] > ZERO_BI) {
      tradeVolumeReserves[i] = tradeVolumeReserves[i].plus(deltaTradeVolumeReserves[i]);
      rollingDailyTradeVolumeReserves[i] = rollingDailyTradeVolumeReserves[i].plus(deltaTradeVolumeReserves[i]);
      rollingWeeklyTradeVolumeReserves[i] = rollingWeeklyTradeVolumeReserves[i].plus(deltaTradeVolumeReserves[i]);
      usdTradeAmount = toDecimal(deltaTradeVolumeReserves[i], tokenInfo.decimals).times(tokenInfo.lastPriceUSD);
    }
    biTradeVolumeReserves[i] = biTradeVolumeReserves[i].plus(deltaTradeVolumeReserves[i].abs());
    rollingDailyBiTradeVolumeReserves[i] = rollingDailyBiTradeVolumeReserves[i].plus(deltaTradeVolumeReserves[i].abs());
    rollingWeeklyBiTradeVolumeReserves[i] = rollingWeeklyBiTradeVolumeReserves[i].plus(deltaTradeVolumeReserves[i].abs());

    transferVolumeReserves[i] = transferVolumeReserves[i].plus(deltaTransferVolumeReserves[i].abs());
    rollingDailyTransferVolumeReserves[i] = rollingDailyTransferVolumeReserves[i].plus(deltaTransferVolumeReserves[i].abs());
    rollingWeeklyTransferVolumeReserves[i] = rollingWeeklyTransferVolumeReserves[i].plus(deltaTransferVolumeReserves[i].abs());
    let usdTransferAmount = toDecimal(deltaTransferVolumeReserves[i].abs(), tokenInfo.decimals).times(tokenInfo.lastPriceUSD);

    tradeVolumeReservesUSD[i] = tradeVolumeReservesUSD[i].plus(usdTradeAmount);
    rollingDailyTradeVolumeReservesUSD[i] = rollingDailyTradeVolumeReservesUSD[i].plus(usdTradeAmount);
    rollingWeeklyTradeVolumeReservesUSD[i] = rollingWeeklyTradeVolumeReservesUSD[i].plus(usdTradeAmount);

    transferVolumeReservesUSD[i] = transferVolumeReservesUSD[i].plus(usdTransferAmount);
    rollingDailyTransferVolumeReservesUSD[i] = rollingDailyTransferVolumeReservesUSD[i].plus(usdTransferAmount);
    rollingWeeklyTransferVolumeReservesUSD[i] = rollingWeeklyTransferVolumeReservesUSD[i].plus(usdTransferAmount);

    totalTradeUSD = totalTradeUSD.plus(usdTradeAmount);
    totalTransferUSD = totalTransferUSD.plus(usdTransferAmount);
  }

  well.cumulativeTradeVolumeReserves = tradeVolumeReserves;
  well.cumulativeTradeVolumeReservesUSD = tradeVolumeReservesUSD;
  well.cumulativeTradeVolumeUSD = well.cumulativeTradeVolumeUSD.plus(totalTradeUSD);
  well.cumulativeBiTradeVolumeReserves = biTradeVolumeReserves;

  well.cumulativeTransferVolumeReserves = transferVolumeReserves;
  well.cumulativeTransferVolumeReservesUSD = transferVolumeReservesUSD;
  well.cumulativeTransferVolumeUSD = well.cumulativeTransferVolumeUSD.plus(totalTransferUSD);

  // Rolling daily/weekly amounts are added immediately, and at at the top of the hour, the oldest
  // hour in the period is removed. This means there is always between 0-1hr of extra data for the period,
  // but this is preferable to having the most recent values being delayed.
  well.rollingDailyTradeVolumeReserves = rollingDailyTradeVolumeReserves;
  well.rollingDailyTradeVolumeReservesUSD = rollingDailyTradeVolumeReservesUSD;
  well.rollingDailyTradeVolumeUSD = well.rollingDailyTradeVolumeUSD.plus(totalTradeUSD);
  well.rollingDailyBiTradeVolumeReserves = rollingDailyBiTradeVolumeReserves;
  well.rollingDailyTransferVolumeReserves = rollingDailyTransferVolumeReserves;
  well.rollingDailyTransferVolumeReservesUSD = rollingDailyTransferVolumeReservesUSD;
  well.rollingDailyTransferVolumeUSD = well.rollingDailyTransferVolumeUSD.plus(totalTransferUSD);

  well.rollingWeeklyTradeVolumeReserves = rollingWeeklyTradeVolumeReserves;
  well.rollingWeeklyTradeVolumeReservesUSD = rollingWeeklyTradeVolumeReservesUSD;
  well.rollingWeeklyTradeVolumeUSD = well.rollingWeeklyTradeVolumeUSD.plus(totalTradeUSD);
  well.rollingWeeklyBiTradeVolumeReserves = rollingWeeklyBiTradeVolumeReserves;
  well.rollingWeeklyTransferVolumeReserves = rollingWeeklyTransferVolumeReserves;
  well.rollingWeeklyTransferVolumeReservesUSD = rollingWeeklyTransferVolumeReservesUSD;
  well.rollingWeeklyTransferVolumeUSD = well.rollingWeeklyTransferVolumeUSD.plus(totalTransferUSD);
}

// Returns the provided token amounts in their appropriate position with respect to well reserve tokens
// Assumption is that if all tokens are already included in the list, their order will be correct.
function padTokenAmounts(allTokens: Address[], includedTokens: Address[], amounts: BigInt[]): BigInt[] {
  if (includedTokens.length < allTokens.length) {
    // Pad with zeros
    const paddedAmounts = emptyBigIntArray(allTokens.length);
    for (let i = 0; i < includedTokens.length; ++i) {
      const tokenIndex = allTokens.indexOf(includedTokens[i]);
      if (tokenIndex >= 0) {
        paddedAmounts[tokenIndex] = amounts[i];
      }
    }
    return paddedAmounts;
  } else {
    return amounts;
  }
}
