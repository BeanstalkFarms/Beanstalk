import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { BD_10, BI_10, ONE_BI, pow, sqrt, toDecimal, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { Pool, Token } from "../../../generated/schema";
import { loadOrCreateToken } from "../Token";
import { UniswapV2Pair } from "../../../generated/BeanUniswapV2Pair/UniswapV2Pair";
import { BEANSTALK, WETH, WETH_USDC_PAIR } from "../../../../subgraph-core/utils/Constants";
import { PreReplant } from "../../../generated/Beanstalk/PreReplant";
import { DeltaBAndPrice, DeltaBPriceLiquidity, TWAType } from "./Types";
import { setPoolTwa } from "../Pool";
import { getTWAPrices } from "./TwaOracle";

export function updatePreReplantPriceETH(): BigDecimal {
  let token = loadOrCreateToken(WETH.toHexString());
  let price = getPreReplantPriceETH();
  if (price.lt(ZERO_BD)) {
    return token.lastPriceUSD;
  }

  token.lastPriceUSD = price;
  token.save();
  return token.lastPriceUSD;
}

export function getPreReplantPriceETH(): BigDecimal {
  let reserves = uniswapV2Reserves(WETH_USDC_PAIR);
  if (reserves.length == 0) {
    return BigDecimal.fromString("-1");
  }
  // Token 0 is USDC and Token 1 is WETH
  return toDecimal(reserves[0]).div(toDecimal(reserves[1], 18));
}

export function calcUniswapV2Inst(pool: Pool): DeltaBPriceLiquidity {
  const wethPrice = updatePreReplantPriceETH();
  const weth_bd = toDecimal(pool.reserves[0], 18);
  const bean_bd = toDecimal(pool.reserves[1]);
  return calcUniswapV2Inst_2(bean_bd, weth_bd, wethPrice);
}

export function calcUniswapV2Inst_2(beanReserves: BigDecimal, token2Reserves: BigDecimal, token2Price: BigDecimal): DeltaBPriceLiquidity {
  return {
    price: constantProductPrice(beanReserves, token2Reserves, token2Price),
    liquidity: token2Reserves.times(token2Price).times(BigDecimal.fromString("2")),
    deltaB: uniswapV2DeltaB(beanReserves, token2Reserves, token2Price)
  };
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
export function constantProductPrice(beanReserves: BigDecimal, token2Reserves: BigDecimal, token2Price: BigDecimal): BigDecimal {
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

// Calculates and sets the TWA on the pool hourly/daily snapshots
export function setUniswapV2Twa(poolAddress: string, timestamp: BigInt, blockNumber: BigInt): void {
  const twaPrices = getTWAPrices(poolAddress, TWAType.UNISWAP, timestamp);
  const twaResult = uniswapTwaDeltaBAndPrice(twaPrices, blockNumber);

  setPoolTwa(poolAddress, twaResult, timestamp, blockNumber);
}

export function uniswapCumulativePrice(pool: Address, tokenIndex: u32, timestamp: BigInt): BigInt {
  const pair = UniswapV2Pair.bind(pool);
  let cumulativeNow = tokenIndex == 0 ? pair.price0CumulativeLast() : pair.price1CumulativeLast();
  const reserves = pair.getReserves();
  const effectiveTimestamp = u32Timestamp(timestamp);
  const timeElapsed = effectiveTimestamp.minus(reserves.value2);
  if (timeElapsed != ZERO_BI) {
    if (tokenIndex == 0) {
      cumulativeNow = cumulativeNow.plus(fraction(reserves.value1, reserves.value0).times(timeElapsed));
    } else {
      cumulativeNow = cumulativeNow.plus(fraction(reserves.value0, reserves.value1).times(timeElapsed));
    }
  }
  return cumulativeNow;
}

export function uniswapTwaDeltaBAndPrice(prices: BigInt[], blockNumber: BigInt): DeltaBAndPrice {
  let beanstalk = PreReplant.bind(BEANSTALK);
  let reserves: BigInt[];
  // After BIP-9, reserves calculation changes
  if (blockNumber.lt(BigInt.fromU64(13953949))) {
    const result = beanstalk.reserves();
    reserves = [result.value0, result.value1];
  } else {
    const result = beanstalk.lockedReserves();
    reserves = [result.value0, result.value1];
  }

  const mulReserves = reserves[0].times(reserves[1]).times(BI_10.pow(6));
  const currentBeans = mulReserves.div(prices[0]).sqrt();
  const targetBeans = mulReserves.div(prices[1]).sqrt();
  const deltaB = targetBeans.minus(currentBeans);
  const twaPrice = BigDecimal.fromString(prices[0].toString()).div(BigDecimal.fromString(prices[1].toString()));

  // log.debug("deltab reserves[0] {}", [reserves[0].toString()]);
  // log.debug("deltab reserves[1] {}", [reserves[1].toString()]);
  // log.debug("deltab mulReserves {}", [mulReserves.toString()]);
  // log.debug("deltab prices[0] {}", [prices[0].toString()]);
  // log.debug("deltab prices[1] {}", [prices[1].toString()]);
  // log.debug("deltab currentBeans {}", [currentBeans.toString()]);
  // log.debug("deltab targetBeans {}", [targetBeans.toString()]);
  // log.debug("deltab deltaB {}", [deltaB.toString()]);

  return {
    deltaB: deltaB,
    price: twaPrice,
    token2Price: null
  };
}

function u32Timestamp(timestamp: BigInt): BigInt {
  return timestamp.mod(ONE_BI.leftShift(32));
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
