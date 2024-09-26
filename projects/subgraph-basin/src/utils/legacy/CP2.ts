import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { BI_10, deltaBigIntArray, emptyBigIntArray, toBigInt, toDecimal, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";

// Retroactive replacement functionality for well function `calcRates` - did not exist in CP2 1.0
export function calcRates(reserves: BigInt[], tokenDecimals: u32[]): BigInt[] {
  if (reserves[0] == ZERO_BI || reserves[1] == ZERO_BI) {
    return [ZERO_BI, ZERO_BI];
  }

  return [reserves[1].times(BI_10.pow(tokenDecimals[0])).div(reserves[0]), reserves[0].times(BI_10.pow(tokenDecimals[1])).div(reserves[1])];
}

/**
 * MANUAL VOLUME CALCULATION IS DEPRECATED. See ../Volume:calcLiquidityVolume
 *
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
export function calcLiquidityVolume_deprecated(currentReserves: BigInt[], addedReserves: BigInt[]): BigInt[] {
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

  // Returns the positive value for the token which was bought and negative for the sold token.
  const tokenAmountBought = [
    initialReserves[0].minus(reservesBeforeBalancedAdd[0]),
    initialReserves[1].minus(reservesBeforeBalancedAdd[1])
  ];
  return tokenAmountBought;
}
