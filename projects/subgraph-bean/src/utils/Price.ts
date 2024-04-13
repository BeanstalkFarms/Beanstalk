import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Bean3CRV } from "../../generated/Bean3CRV-V1/Bean3CRV";
import { BI_10, toDecimal, ZERO_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { Token } from "../../generated/schema";
import { loadOrCreateToken } from "./Token";
import { UniswapV2Pair } from "../../generated/BeanUniswapV2Pair/UniswapV2Pair";
import {
  BEAN_3CRV_V1,
  BEAN_LUSD_V1,
  CALCULATIONS_CURVE,
  CRV3_POOL_V1,
  LUSD,
  LUSD_3POOL,
  WETH,
  WETH_USDC_PAIR
} from "../../../subgraph-core/utils/Constants";
import { CalculationsCurve } from "../../generated/Bean3CRV-V1/CalculationsCurve";
import { ERC20 } from "../../generated/Bean3CRV-V1/ERC20";

// Pre-replant prices are unavailable from the beanstalk contracts
// Note that the Bean3CRV type applies to any curve pool (including lusd)

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

// Returns the price of beans in a uniswapv2 constant product pool
export function uniswapV2Price(beanReserves: BigDecimal, token2Reserves: BigDecimal, token2Price: BigDecimal): BigDecimal {
  return token2Reserves.times(token2Price).div(beanReserves);
}

// Returns the deltaB in a uniswapv2 constant product pool
export function uniswapV2DeltaB(beanReserves: BigInt, token2Reserves: BigDecimal, token2Price: BigDecimal): BigInt {
  if (beanReserves == ZERO_BI) {
    return ZERO_BI;
  }
  const constantProduct = BigDecimal.fromString(beanReserves.toString()).times(token2Reserves);
  const beansAfterSwap = BigInt.fromString(constantProduct.times(token2Price).truncate(0).toString()).sqrt();
  const deltaB = beansAfterSwap.minus(beanReserves);
  return deltaB;
}

// Returns [beanPrice, lpValue] of the requested curve pool
export function curvePriceAndLp(pool: Address): BigDecimal[] {
  // Get Curve Price Details
  let curveCalc = CalculationsCurve.bind(CALCULATIONS_CURVE);
  let metapoolPrice = toDecimal(curveCalc.getCurvePriceUsdc(CRV3_POOL_V1));

  let lpContract = Bean3CRV.bind(pool);
  let beanCrvPrice = ZERO_BD;

  let lpValue = ZERO_BD;
  if (pool == BEAN_3CRV_V1) {
    beanCrvPrice = toDecimal(lpContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromI32(1000000)), 18);

    let crv3PoolContract = ERC20.bind(CRV3_POOL_V1);
    let crvHolding = toDecimal(crv3PoolContract.balanceOf(pool), 18);
    lpValue = crvHolding.times(metapoolPrice);
  } else if (pool == BEAN_LUSD_V1) {
    // price in LUSD
    let priceInLusd = toDecimal(lpContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromI32(1000000)), 18);

    let lusdContract = ERC20.bind(LUSD);
    let lusd3PoolContract = Bean3CRV.bind(LUSD_3POOL);
    let lusd3crvPrice = toDecimal(lusd3PoolContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromString("1000000000000000000")), 18);
    beanCrvPrice = priceInLusd.times(lusd3crvPrice);

    let lusdHolding = toDecimal(lusdContract.balanceOf(pool), 18);
    lpValue = lusdHolding.times(lusd3crvPrice).times(metapoolPrice);
  }

  let beanPrice = metapoolPrice.times(beanCrvPrice);

  return [beanPrice, lpValue];
}

// Returns the deltaB in the given curve pool
export function curveDeltaB(pool: Address, beanReserves: BigInt): BigInt {
  let lpContract = Bean3CRV.bind(pool);
  // D = vprice * total lp tokens
  // vprice: 12 decimals, tokens: 18 decimals
  const D = lpContract.get_virtual_price().times(lpContract.totalSupply()).div(BI_10.pow(30));
  // D / 2 - beanReserves
  const deltaB = D.div(BigInt.fromU32(2)).minus(beanReserves);
  return deltaB;
}

// // Based on get_D from dune query here https://dune.com/queries/3561823/5993924
// export function get_D(xp: Array<f64>, amp: f64, n_coins: i32, a_precision: i32): f64 {
//     let s: f64 = 0;
//     let d_prev: f64 = 0;
//     let d: f64;
//     let ann: f64;
//     let d_p: f64;

//     for (let i = 0; i < xp.length; i++) {
//         s += xp[i];
//     }

//     if (s == 0) {
//         return 0;
//     }
//     d = s;
//     ann = amp * n_coins;

//     let _i: i32 = 0;
//     while (_i < 255) {
//         d_p = d;
//         for (let j = 0; j < xp.length; j++) {
//             d_p = d_p * d / (xp[j] * n_coins);
//         }
//         d_prev = d;
//         d = (ann * s / a_precision + d_p * n_coins) * d / ((ann - a_precision) * d / a_precision + (n_coins + 1) * d_p);

//         if ((d > d_prev && d - d_prev <= 1) || (d_prev > d && d_prev - d <= 1)) {
//             break;
//         }
//         _i++;
//     }
//     return d;
// }

// // Based on get_y from dune query here https://dune.com/queries/3561823/5993924
// export function get_y(i: i32, j: i32, x: f64, xp: Array<f64>, amp: f64, n_coins: i32, a_precision: i32): f64 {
//   let su: f64 = 0;
//   let _x: f64 = 0;
//   let y_prev: f64 = 0;
//   let c: f64;
//   let ann: f64;
//   let d: f64;
//   let b: f64;
//   let y: f64;

//   d = get_D(xp, amp, n_coins, a_precision);
//   c = d;
//   ann = amp * n_coins;

//   for (let _i = 0; _i < n_coins; _i++) {
//       if (_i == i) {
//           _x = x;
//           su += _x;
//           c = c * d / (_x * n_coins);
//       } else if (_i != j) {
//           _x = xp[i];
//           su += _x;
//           c = c * d / (_x * n_coins);
//       }
//   }

//   c = c * d * a_precision / (ann * n_coins);
//   b = su + d * a_precision / ann;
//   y = d;

//   for (let _i = 0; _i < 255; _i++) {
//       y_prev = y;
//       y = (y * y + c) / (2 * y + b - d);

//       if ((y > y_prev && y - y_prev <= 1) || (y_prev > y && y_prev - y <= 1)) {
//           return y;
//       }
//   }

//   return -1;
// }
