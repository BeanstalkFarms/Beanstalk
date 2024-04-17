import { Address, BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Bean3CRV } from "../../../generated/Bean3CRV-V1/Bean3CRV";
import { BI_10, ONE_BI, toDecimal, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { BEAN_3CRV_V1, BEAN_LUSD_V1, CALCULATIONS_CURVE, CRV3_POOL_V1, LUSD, LUSD_3POOL } from "../../../../subgraph-core/utils/Constants";
import { CalculationsCurve } from "../../../generated/Bean3CRV-V1/CalculationsCurve";
import { ERC20 } from "../../../generated/Bean3CRV-V1/ERC20";
import { DeltaBAndPrice } from "./Types";

// Note that the Bean3CRV type applies to any curve pool (including lusd)

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

// TODO: this logic can be refactored to remove the contract calls and instead use getD method.
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

export function curveCumulativePrices(pool: Address, timestamp: BigInt): BigInt[] {
  let curve = Bean3CRV.bind(pool);
  const cumulativeLast = curve.get_price_cumulative_last();
  const currentBalances = curve.get_balances();
  const lastTimestamp = curve.block_timestamp_last();

  const deltaLastTimestamp = timestamp.minus(lastTimestamp);
  const cumulativeBalances = [
    cumulativeLast[0].plus(currentBalances[0].times(deltaLastTimestamp)),
    cumulativeLast[1].plus(currentBalances[1].times(deltaLastTimestamp))
  ];
  return cumulativeBalances;
}

// beanPool is the pool with beans trading against otherPool's tokens.
// otherPool is needed to get the virtual price of that token beans are trading against.
export function curveTwaDeltaBAndPrice(twaBalances: BigInt[], beanPool: Address, otherPool: Address): DeltaBAndPrice {
  let beanCurve = Bean3CRV.bind(beanPool);
  const bean_A = beanCurve.A_precise();
  let otherCurve = Bean3CRV.bind(otherPool);
  const other_A = otherCurve.A_precise();

  const xp = [twaBalances[0].times(BI_10.pow(12)), twaBalances[1].times(other_A).div(BI_10.pow(18))];

  const D = getD(xp, bean_A);

  return {
    deltaB: D.div(BigInt.fromU32(2)).div(BI_10.pow(12)).minus(twaBalances[0]),
    price: ZERO_BD // TODO
  };
}

// Generated from functions in LibCurve.sol
function getD(xp: BigInt[], a: BigInt): BigInt {
  const A_PRECISION = BigInt.fromU32(100);
  const N_COINS = BigInt.fromU32(2);

  let S: BigInt = BigInt.fromString("0");
  let Dprev: BigInt;
  let D: BigInt = BigInt.fromString("0");

  // Summing elements in the array
  for (let i = 0; i < xp.length; ++i) {
    S = S.plus(xp[i]);
  }
  if (S.toString() == "0") return BigInt.fromString("0");

  D = S;
  let Ann: BigInt = a.times(N_COINS);

  for (let i = 0; i < 256; ++i) {
    let D_P: BigInt = D;
    for (let j = 0; j < xp.length; ++j) {
      D_P = D_P.times(D).div(xp[j].times(N_COINS));
    }
    Dprev = D;
    let num: BigInt = Ann.times(S).div(A_PRECISION).plus(D_P.times(N_COINS)).times(D);
    let denom: BigInt = Ann.minus(A_PRECISION).times(D).div(A_PRECISION).plus(N_COINS.plus(ONE_BI).times(D_P));
    D = num.div(denom);

    // Check convergence
    if (D == Dprev || D.minus(Dprev) == ONE_BI || Dprev.minus(D) == ONE_BI) {
      return D;
    }
  }
  throw new Error("Price: Convergence false");
}

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
