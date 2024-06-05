import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { loadWell } from "./Well";
import { loadToken } from "./Token";
import {
  deltaBigIntArray,
  emptyBigDecimalArray,
  emptyBigIntArray,
  toBigInt,
  toDecimal,
  ZERO_BD,
  ZERO_BI
} from "../../../subgraph-core/utils/Decimals";
import { Token } from "../../generated/schema";
import { BigDecimal_indexOfMin, BigDecimal_max, BigDecimal_min, BigDecimal_sum } from "../../../subgraph-core/utils/ArrayMath";

// Constant product volume calculations

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
  const wellTokens = well.tokens.map<Address>((t) => Address.fromBytes(t));
  const tokenInfos = wellTokens.map<Token>((t) => loadToken(t));

  const usdAmounts: BigDecimal[] = [];
  const usdAmountsAbs: BigDecimal[] = [];
  for (let i = 0; i < tokens.length; ++i) {
    const tokenIndex = well.tokens.indexOf(tokens[i]);
    const tokenInfo = tokenInfos[tokenIndex];
    usdAmounts.push(toDecimal(amounts[i], tokenInfo.decimals).times(tokenInfo.lastPriceUSD));
    usdAmountsAbs.push(toDecimal(amounts[i].abs(), tokenInfo.decimals).times(tokenInfo.lastPriceUSD));

    // Update swap volume for individual reserves. Trade volume is not known yet.
    // Transfer volume is considered on both ends of the trade.
    let transferVolumeReserves = well.cumulativeTransferVolumeReserves;
    let transferVolumeReservesUSD = well.cumulativeTransferVolumeReservesUSD;
    transferVolumeReserves[tokenIndex] = transferVolumeReserves[tokenIndex].plus(amounts[i].abs());
    transferVolumeReservesUSD[tokenIndex] = transferVolumeReservesUSD[tokenIndex].plus(usdAmountsAbs[i]);
    well.cumulativeTransferVolumeReserves = transferVolumeReserves;
    well.cumulativeTransferVolumeReservesUSD = transferVolumeReservesUSD;
  }

  // INCORRECT:
  // let minAmount = tokens.length == well.tokens.length ? BigDecimal_min(usdAmountsAbs) : ZERO_BD;
  // let usdVolume = BigDecimal_max(usdAmountsAbs).minus(minAmount).div(BigDecimal.fromString(well.tokens.length.toString()));

  // Determine which token is bought and increment its trade volume.
  // The amount of tokens being bought can be computed as usdVolume/price.
  // const boughtTokenIndex = indexOfLiquidityBoughtToken(wellTokens, tokens, usdAmounts);
  // const boughtTokenAmount = usdVolume.div(tokenInfos[boughtTokenIndex].lastPriceUSD);
  // const boughtTokenBI = toBigInt(boughtTokenAmount, tokenInfos[boughtTokenIndex].decimals);
  const boughtToken = calcLiquidityVolume(well.reserves, padTokenAmounts(wellTokens, tokens, amounts));
  let usdVolume = ZERO_BD;

  let tradeVolumeReserves = well.cumulativeTradeVolumeReserves;
  let tradeVolumeReservesUSD = well.cumulativeTradeVolumeReservesUSD;
  for (let i = 0; i < boughtToken.length; ++i) {
    tradeVolumeReserves[i] = tradeVolumeReserves[i].plus(boughtToken[i]);
    if (boughtToken[i] > ZERO_BI) {
      usdVolume = toDecimal(boughtToken[i], tokenInfos[i].decimals).times(tokenInfos[i].lastPriceUSD);
      tradeVolumeReservesUSD[i] = tradeVolumeReservesUSD[i].plus(usdVolume);
    }
  }
  well.cumulativeTradeVolumeReserves = tradeVolumeReserves;
  well.cumulativeTradeVolumeReservesUSD = tradeVolumeReservesUSD;

  // Update cumulative usd volume. Trade volume is determined based on the amount of price fluctuation
  // caused by the liquidity event.
  let cumulativeTransfer = BigDecimal_sum(usdAmountsAbs);
  well.cumulativeTradeVolumeUSD = well.cumulativeTradeVolumeUSD.plus(usdVolume);
  well.cumulativeTransferVolumeUSD = well.cumulativeTransferVolumeUSD.plus(cumulativeTransfer);

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

// TODO: update these comments
/**
 * Calculates the amount of volume resulting from a liquidity add operation.
 * The following system of equations was solved:
 *
 * let initial reserves = i
 * let amount of reserves added = d
 *
 * (i0 + x)(i0 - y) = i0 * i1
 * (i0 + x)r = i0 + d0
 * (i1 - y)r = i1 + d1
 *
 * Assumption is that only one of d0 or d1 will be nonzero.
 *
 * Example: 1500 BEAN and 1 ETH. If 1500 BEAN liquidity is added, in terms of buy pressure, this is equivalent
 * to buying 0.29289 ETH for 621 BEAN and then adding in equal proportions.
 *
 * @param currentReserves - the current reserves, after the liquidity event
 * @param addedReserves - the net change in reserves after the liquidity event
 * @returns a list of tokens and the amount bought of each. in practice only one will be nonzero, and always postive.
 */
export function calcLiquidityVolume(currentReserves: BigInt[], addedReserves: BigInt[]): BigInt[] {
  // Reserves prior to adding liquidity
  const initialReserves = deltaBigIntArray(currentReserves, addedReserves);
  const initialCp = initialReserves[0].times(initialReserves[1]);
  const currentCp = currentReserves[0].times(currentReserves[1]);

  if (initialCp == ZERO_BI || currentCp == ZERO_BI) {
    // Either there was no liquidity, or there is no liquidity. In either case, this is not volume.
    return emptyBigIntArray(2);
  }

  const scale = new BigDecimal(initialCp).div(new BigDecimal(currentCp));
  // Reserves after the "buy" portion of the imbalanced liquidity addition
  const reservesBeforeBalancedAdd = [
    BigInt.fromString(new BigDecimal(currentReserves[0]).times(scale).truncate(0).toString()),
    BigInt.fromString(new BigDecimal(currentReserves[1]).times(scale).truncate(0).toString())
  ];

  // The negative value is the token which got bought (removed from the pool).
  // Returns the positive value for the token which was bought and zero for the other token.
  const tokenAmountBought = [
    reservesBeforeBalancedAdd[0].minus(initialReserves[0]) < ZERO_BI ? initialReserves[0].minus(reservesBeforeBalancedAdd[0]) : ZERO_BI,
    reservesBeforeBalancedAdd[1].minus(initialReserves[1]) < ZERO_BI ? initialReserves[1].minus(reservesBeforeBalancedAdd[1]) : ZERO_BI
  ];
  return tokenAmountBought;
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

// TODO: update these comments. This method may no longer be necessary
/**
 * Returns the index of the token which was effectively bought by this liquidity operation. Example:
 * Adding beans = selling bean/buying weth
 * Removing beans = buying beans/selling weth
 * => the token that there is fewest of is being bought (including negative for removal).
 * @param allTokens - all tokens in the well
 * @param eventTokens - tokens which were added/removed by the liquidity event
 * @param usdAmountAdded - usd value of tokens which were added. Is negative for removal
 *
 * eventTokens and usdAmounts lists must be the same size as their values correspond to one another.
 *
 */
function indexOfLiquidityBoughtToken(allTokens: Address[], eventTokens: Address[], usdAmountAdded: BigDecimal[]): u32 {
  let usdAmountList: BigDecimal[];
  if (eventTokens.length < allTokens.length) {
    // Pad with zeros
    usdAmountList = emptyBigDecimalArray(allTokens.length);
    for (let i = 0; i < eventTokens.length; ++i) {
      const tokenIndex = allTokens.indexOf(eventTokens[i]);
      if (tokenIndex >= 0) {
        usdAmountList[tokenIndex] = usdAmountAdded[i];
      }
    }
  } else {
    usdAmountList = usdAmountAdded;
  }
  return BigDecimal_indexOfMin(usdAmountList);
}
