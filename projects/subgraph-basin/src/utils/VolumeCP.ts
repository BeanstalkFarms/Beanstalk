import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { loadWell } from "./Well";
import { loadToken } from "./Token";
import { deltaBigIntArray, emptyBigIntArray, toBigInt, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { Token, Well } from "../../generated/schema";
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

  const deltaTradeVolumeReserves = emptyBigIntArray(well.tokens.length);
  const deltaTransferVolumeReserves = emptyBigIntArray(well.tokens.length);

  // Trade volume is considered on the buying end of the trade
  deltaTradeVolumeReserves[well.tokens.indexOf(toToken)] = amountOut;
  // Transfer volume is considered on both ends of the trade
  deltaTransferVolumeReserves[well.tokens.indexOf(fromToken)] = amountIn;
  deltaTransferVolumeReserves[well.tokens.indexOf(toToken)] = amountOut;

  updateVolumeStats(well, deltaTradeVolumeReserves, deltaTransferVolumeReserves);

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

  // Determines which tokens were bough/sold and how much
  const tradeAmount = calcLiquidityVolume(well.reserves, padTokenAmounts(wellTokens, tokens, amounts));
  const deltaTransferVolumeReserves = padTokenAmounts(wellTokens, tokens, amounts);

  updateVolumeStats(well, tradeAmount, deltaTransferVolumeReserves);

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
 * @returns a list of tokens and the amount bought of each. the purchased token is positive, the sold token negative.
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

  // Returns the positive value for the token which was bought and negative for the sold token.
  const tokenAmountBought = [
    initialReserves[0].minus(reservesBeforeBalancedAdd[0]),
    initialReserves[1].minus(reservesBeforeBalancedAdd[1])
  ];
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
    const tokenInfo = loadToken(Address.fromBytes(well.tokens[i]));
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
