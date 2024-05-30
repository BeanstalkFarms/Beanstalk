import { Address, BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { Bean3CRV } from "../../../generated/Bean3CRV-V1/Bean3CRV";
import { BD_10, BI_10, ONE_BI, toDecimal, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import {
  BEAN_3CRV_V1,
  BEAN_LUSD_V1,
  CALCULATIONS_CURVE,
  CRV3_POOL,
  CRV3_TOKEN,
  LUSD,
  LUSD_3POOL
} from "../../../../subgraph-core/utils/Constants";
import { CalculationsCurve } from "../../../generated/Bean3CRV-V1/CalculationsCurve";
import { ERC20 } from "../../../generated/Bean3CRV-V1/ERC20";
import { DeltaBAndPrice, DeltaBPriceLiquidity, TWAType } from "./Types";
import { Pool } from "../../../generated/schema";
import { getTWAPrices, loadOrCreateTwaOracle } from "./TwaOracle";
import { setPoolTwa } from "../Pool";

// Note that the Bean3CRV type applies to any curve pool (including lusd)

// get_dy method returns the price with the fee already applied, divide by this value to unapply the fee
const amountAfterFee = BigDecimal.fromString("0.9996");

// Returns [beanPrice, lpValue] of the requested curve pool
export function curvePriceAndLp(pool: Address): BigDecimal[] {
  // Get Curve Price Details
  let curveCalc = CalculationsCurve.bind(CALCULATIONS_CURVE);
  let metapoolPrice = toDecimal(curveCalc.getCurvePriceUsdc(CRV3_TOKEN));

  let lpContract = Bean3CRV.bind(pool);
  let beanCrvPrice = ZERO_BD;

  let lpValue = ZERO_BD;
  if (pool == BEAN_3CRV_V1) {
    beanCrvPrice = toDecimal(lpContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromI32(1000000)), 18).div(amountAfterFee);

    let crv3Contract = ERC20.bind(CRV3_TOKEN);
    let crvHolding = toDecimal(crv3Contract.balanceOf(pool), 18);
    lpValue = crvHolding.times(metapoolPrice);
  } else if (pool == BEAN_LUSD_V1) {
    // price in LUSD
    let priceInLusd = toDecimal(lpContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromI32(1000000)), 18).div(amountAfterFee);

    let lusdContract = ERC20.bind(LUSD);
    let lusd3PoolContract = Bean3CRV.bind(LUSD_3POOL);
    let lusd3crvPrice = toDecimal(lusd3PoolContract.get_dy(ZERO_BI, BigInt.fromI32(1), BigInt.fromString("1000000000000000000")), 18).div(
      amountAfterFee
    );
    beanCrvPrice = priceInLusd.times(lusd3crvPrice);

    let lusdHolding = toDecimal(lusdContract.balanceOf(pool), 18);
    lpValue = lusdHolding.times(lusd3crvPrice).times(metapoolPrice);
  }

  let beanPrice = metapoolPrice.times(beanCrvPrice);

  return [beanPrice, lpValue];
}

export function calcCurveInst(pool: Pool): DeltaBPriceLiquidity {
  const priceAndLp = curvePriceAndLp(Address.fromString(pool.id));
  return {
    price: priceAndLp[0],
    liquidity: priceAndLp[1],
    deltaB: curveDeltaBUsingVPrice(Address.fromString(pool.id), pool.reserves[0])
  };
}

// Returns the deltaB in the given curve pool using virtual_price.
export function curveDeltaBUsingVPrice(pool: Address, beanReserves: BigInt): BigInt {
  let lpContract = Bean3CRV.bind(pool);
  // D = vprice * total lp tokens
  // vprice: 12 decimals, tokens: 18 decimals
  const D = lpContract.get_virtual_price().times(lpContract.totalSupply()).div(BI_10.pow(30));
  // D / 2 - beanReserves
  const deltaB = D.div(BigInt.fromU32(2)).minus(beanReserves);
  return deltaB;
}

// Calculates and sets the TWA on the pool hourly/daily snapshots
export function setCurveTwa(poolAddress: string, timestamp: BigInt, blockNumber: BigInt): void {
  const twaBalances = getTWAPrices(poolAddress, TWAType.CURVE, timestamp);
  const beanPool = Address.fromString(poolAddress);
  const otherPool = beanPool == BEAN_LUSD_V1 ? LUSD_3POOL : CRV3_POOL;
  const twaResult = curveTwaDeltaBAndPrice(twaBalances, beanPool, otherPool);

  setPoolTwa(poolAddress, twaResult, timestamp, blockNumber);
}

export function curveCumulativePrices(pool: Address, timestamp: BigInt): BigInt[] {
  let cumulativeLast: BigInt[];
  let currentBalances: BigInt[];
  let lastTimestamp: BigInt;
  if (pool == BEAN_3CRV_V1) {
    let curve = Bean3CRV.bind(pool);
    cumulativeLast = curve.get_price_cumulative_last();
    currentBalances = curve.get_balances();
    lastTimestamp = curve.block_timestamp_last();
  } else {
    // if (pool == BEAN_LUSD_V1) {
    // BEANLUSD does not have the above functions, uses manual calculation
    // BEAN_3CRV(_V2) uses this also, oracle values are updated from MetapoolOracle event.
    let twaOracle = loadOrCreateTwaOracle(pool.toHexString());
    cumulativeLast = twaOracle.priceCumulativeLast;
    currentBalances = twaOracle.lastBalances;
    lastTimestamp = twaOracle.lastUpdated;
  }

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
  const bean_A = getBean_A(beanPool);
  let otherCurve = Bean3CRV.bind(otherPool);
  const other_virtual_price = otherCurve.get_virtual_price();

  const xp = [twaBalances[0].times(BI_10.pow(12)), twaBalances[1].times(other_virtual_price).div(BI_10.pow(18))];

  const D = getD(xp, bean_A);
  const y = getY(xp[0].plus(BI_10.pow(12)), xp, bean_A, D);

  // log.debug("curve bean_A {}", [bean_A.toString()]);
  // log.debug("curve other_virtual_price {}", [other_virtual_price.toString()]);
  // log.debug("curve D {}", [D.toString()]);
  // log.debug("curve y {}", [y.toString()]);
  // log.debug("curve deltaB calculated {}", [D.div(BigInt.fromU32(2)).div(BI_10.pow(12)).minus(twaBalances[0]).toString()]);
  // log.debug("curve deltaB simple {}", [curveDeltaBUsingVPrice(beanPool, twaBalances[0]).toString()]);
  // log.debug("curve xp[0] {}", [xp[0].toString()]);
  // log.debug("curve xp[1] {}", [xp[1].toString()]);

  return {
    deltaB: deltaFromD(D, twaBalances[0]),
    price: priceFromY(y, xp[1]),
    token2Price: null
  };
}

export function deltaFromD(D: BigInt, beanBalance: BigInt): BigInt {
  return D.div(BigInt.fromU32(2)).div(BI_10.pow(12)).minus(beanBalance);
}

export function priceFromY(y: BigInt, nonBeanXp: BigInt): BigDecimal {
  return BigDecimal.fromString(nonBeanXp.minus(y).minus(ONE_BI).toString()).div(BigDecimal.fromString("1000000000000"));
}

// In practice we can hardcode and avoid an unnecessary call since there was no ramping in our pools
function getBean_A(beanPool: Address): BigInt {
  // let beanCurve = Bean3CRV.bind(beanPool);
  // const bean_A = beanCurve.A_precise();
  if (beanPool == BEAN_3CRV_V1) {
    return BigInt.fromU32(1000);
  } else if (beanPool == BEAN_LUSD_V1) {
    return BigInt.fromU32(10000);
  } else {
    // BEAN3CRV
    return BigInt.fromU32(100);
  }
}

// These are the same for both the 3crv and lusd pools
const A_PRECISION = BigInt.fromU32(100);
const N_COINS = BigInt.fromU32(2);

// Generated from functions in LibCurve.sol
export function getD(xp: BigInt[], a: BigInt): BigInt {
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
  log.debug("curve_error xp[0] {}", [xp[0].toString()]);
  log.debug("curve_error xp[1] {}", [xp[1].toString()]);
  log.debug("curve_error a {}", [a.toString()]);
  throw new Error("Price: Convergence failed");
}

const i = 0;
const j = 1;

export function getY(x: BigInt, xp: BigInt[], a: BigInt, D: BigInt): BigInt {
  let S_: BigInt = BigInt.fromString("0");
  let _x: BigInt = BigInt.fromString("0");
  let y_prev: BigInt;
  let y: BigInt = D;
  let c: BigInt = D;
  let Ann: BigInt = a.times(N_COINS);

  // Calculate c considering each element in xp
  for (let _i = 0; _i < N_COINS.toI32(); ++_i) {
    if (_i == i) _x = x;
    else if (_i != j) _x = xp[i];
    else continue;
    S_ = S_.plus(_x);
    c = c.times(D).div(_x.times(N_COINS));
  }

  c = c.times(D).times(A_PRECISION).div(Ann.times(N_COINS));
  let b: BigInt = S_.plus(D.times(A_PRECISION).div(Ann));

  for (let _i = 0; _i < 255; ++_i) {
    y_prev = y;
    y = y
      .times(y)
      .plus(c)
      .div(y.times(BigInt.fromString("2")).plus(b).minus(D));
    if (y == y_prev || y.minus(y_prev) == ONE_BI || y_prev.minus(y) == ONE_BI) {
      return y;
    }
  }
  log.debug("curve_error x {}", [x.toString()]);
  log.debug("curve_error xp[0] {}", [xp[0].toString()]);
  log.debug("curve_error xp[1] {}", [xp[1].toString()]);
  log.debug("curve_error a {}", [a.toString()]);
  log.debug("curve_error D {}", [D.toString()]);
  throw new Error("Price: Convergence failed");
}
