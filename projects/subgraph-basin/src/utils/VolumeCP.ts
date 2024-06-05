import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { loadWell } from "./Well";
import { loadToken } from "./Token";
import { deltaBigIntArray, emptyBigIntArray, toBigInt, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { Token } from "../../generated/schema";
import { BigDecimal_sum } from "../../../subgraph-core/utils/ArrayMath";

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

  // Determines which token is bought and how much was bought
  const boughtTokens = calcLiquidityVolume(well.reserves, padTokenAmounts(wellTokens, tokens, amounts));

  // Add to trade volume
  let usdVolume = ZERO_BD;
  let tradeVolumeReserves = well.cumulativeTradeVolumeReserves;
  let tradeVolumeReservesUSD = well.cumulativeTradeVolumeReservesUSD;
  for (let i = 0; i < boughtTokens.length; ++i) {
    tradeVolumeReserves[i] = tradeVolumeReserves[i].plus(boughtTokens[i]);
    if (boughtTokens[i] > ZERO_BI) {
      usdVolume = toDecimal(boughtTokens[i], tokenInfos[i].decimals).times(tokenInfos[i].lastPriceUSD);
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

/**
 * Calculates the amount of volume resulting from a liquidity add operation.
 * The methodology is as follows:
 *
 * When adding liquidity in unbalanced proportions, we treat it as if some of one asset must first be bought,
 * and then the rest is added in a balanced proportion.
 *
 * We know the constant product before adding liquidity, and after adding liquidity. The
 * newer constant product can be scaled down until it reaches the older constant product.
 * From there, it becomes clear how much of an asset must have been purchased as a result.
 *
 * Example: initial 1500 BEAN and 1 ETH. If 1500 BEAN liquidity is added, in terms of buy pressure, this is equivalent
 * to buying 0.29289 ETH for 621 BEAN and then adding in equal proportions.
 * After that purchase there would be 2121 BEAN and 0.70711 ETH, which can be scaled up to (3000, 1) in equal proportion.
 * The below implementation solves this scenario backwards.
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

  // The overall product is scaled by `scale`, so the individual assets must be scaled by `scaleSqrt`
  const scale = new BigDecimal(initialCp).div(new BigDecimal(currentCp));
  const scaleSqrt = toDecimal(toBigInt(scale, 36).sqrt(), 18);
  // Reserves after the "buy" portion of the imbalanced liquidity addition
  const reservesBeforeBalancedAdd = [
    BigInt.fromString(new BigDecimal(currentReserves[0]).times(scaleSqrt).truncate(0).toString()),
    BigInt.fromString(new BigDecimal(currentReserves[1]).times(scaleSqrt).truncate(0).toString())
  ];

  // log.debug("currentReserves [{}, {}]", [currentReserves[0].toString(), currentReserves[1].toString()]);
  // log.debug("initialReserves [{}, {}]", [initialReserves[0].toString(), initialReserves[1].toString()]);
  // log.debug("initialCp {}", [initialCp.toString()]);
  // log.debug("currentCp {}", [currentCp.toString()]);
  // log.debug("scale {}", [scale.toString()]);
  // log.debug("scaleSqrt {}", [scaleSqrt.toString()]);
  // log.debug("reservesBeforeBalancedAdd [{}, {}]", [reservesBeforeBalancedAdd[0].toString(), reservesBeforeBalancedAdd[1].toString()]);

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
