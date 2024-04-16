import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { BD_10, ONE_BI, pow, sqrt, toDecimal, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { Token } from "../../../generated/schema";
import { loadOrCreateToken } from "../Token";
import { UniswapV2Pair } from "../../../generated/BeanUniswapV2Pair/UniswapV2Pair";
import { WETH, WETH_USDC_PAIR } from "../../../../subgraph-core/utils/Constants";

export function updatePreReplantPriceETH(): Token {
  let token = loadOrCreateToken(WETH.toHexString());
  let pair = UniswapV2Pair.bind(WETH_USDC_PAIR);

  let reserves = pair.try_getReserves();
  if (reserves.reverted) {
    return token;
  }

  // Token 0 is USDC and Token 1 is WETH
  token.lastPriceUSD = toDecimal(reserves.value.value0).div(toDecimal(reserves.value.value1, 18));
  token.save();
  return token;
}

// For our single uniswapv2 pool, token 0 is WETH and token 1 is BEAN
export function uniswapV2Reserves(pool: Address): BigInt[] {
  let pair = UniswapV2Pair.bind(pool);

  let reserves = pair.try_getReserves();
  if (reserves.reverted) {
    return [];
  }
  return [reserves.value.value0, reserves.value.value1];
}

// Returns the current price of beans in a uniswapv2 constant product pool
export function uniswapV2Price(beanReserves: BigDecimal, token2Reserves: BigDecimal, token2Price: BigDecimal): BigDecimal {
  return token2Reserves.times(token2Price).div(beanReserves);
}

// Returns the deltaB in a uniswapv2 constant product pool
export function uniswapV2DeltaB(beanReserves: BigDecimal, token2Reserves: BigDecimal, token2Price: BigDecimal): BigInt {
  if (beanReserves == ZERO_BD) {
    return ZERO_BI;
  }
  const constantProduct = beanReserves.times(token2Reserves);
  const beansAfterSwap = sqrt(constantProduct.times(token2Price));
  const deltaB = beansAfterSwap.minus(beanReserves);
  return BigInt.fromString(deltaB.times(pow(BD_10, 6)).truncate(0).toString());
}

export function uniswapCumulativePrice(pool: Address, tokenIndex: u32, timestamp: BigInt): BigInt {
  const pair = UniswapV2Pair.bind(pool);
  let cumulativeNow = tokenIndex == 0 ? pair.price0CumulativeLast() : pair.price1CumulativeLast();
  const reserves = pair.getReserves();
  const effectiveTimestamp = u32Timestamp(timestamp);
  const timeElapsed = effectiveTimestamp.minus(reserves.value2);
  if (timeElapsed > ZERO_BI) {
    if (tokenIndex == 0) {
      cumulativeNow = cumulativeNow.plus(fraction(reserves.value1, reserves.value0).times(timeElapsed));
    } else {
      cumulativeNow = cumulativeNow.plus(fraction(reserves.value0, reserves.value1).times(timeElapsed));
    }
  }
  return cumulativeNow;
}

function u32Timestamp(timestamp: BigInt): BigInt {
  return timestamp.mod(BigInt.fromU32(2).leftShift(32));
}

// Generated functions from here. Needed in calculating cumulative price
// https://github.com/Uniswap/solidity-lib/blob/master/contracts/libraries/FixedPoint.sol
// https://github.com/Uniswap/solidity-lib/blob/master/contracts/libraries/FullMath.sol
function fraction(numerator: BigInt, denominator: BigInt): BigInt {
  if (denominator == ZERO_BI) {
    throw new Error("division by zero");
  }
  if (numerator == ZERO_BI) {
    return ZERO_BI;
  }

  const Q112 = BigInt.fromU32(2).pow(112);

  if (numerator < BigInt.fromU32(2).pow(144).minus(ONE_BI)) {
    let result = numerator.leftShift(112).div(denominator);
    if (result > BigInt.fromU32(2).pow(224).minus(ONE_BI)) {
      throw new Error("overflow");
    }
    return result;
  } else {
    let result = mulDiv(numerator, Q112, denominator);
    if (result > BigInt.fromU32(2).pow(224).minus(ONE_BI)) {
      throw new Error("overflow");
    }
    return result;
  }
}

function mulDiv(x: BigInt, y: BigInt, d: BigInt): BigInt {
  if (d == ZERO_BI) {
    throw new Error("division by zero");
  }

  let l = x.times(y);
  let mm = l.mod(d);
  if (mm > l) {
    throw new Error("FullMath: overflow in mulDiv");
  }

  l = l.minus(mm);

  if (d < l) {
    throw new Error("FullMath: FULLDIV_OVERFLOW");
  }
  return l.div(d);
}
