import { BigInt, Address, BigDecimal, Bytes, log } from "@graphprotocol/graph-ts";
import { TwaOracle } from "../../../generated/schema";
import { BI_10, emptyBigIntArray, ONE_BI, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { uniswapCumulativePrice } from "./UniswapPrice";
import { WETH_USDC_PAIR } from "../../../../subgraph-core/utils/Constants";
import { curveCumulativePrices } from "./CurvePrice";
import { TWAType } from "./Types";
import { wellCumulativePrices, wellTwaReserves } from "./WellPrice";
import { WellOracle } from "../../../generated/TWAPOracles/BIP37";

export function loadOrCreateTwaOracle(poolAddress: string): TwaOracle {
  let twaOracle = TwaOracle.load(poolAddress);
  if (twaOracle == null) {
    twaOracle = new TwaOracle(poolAddress);
    twaOracle.pool = poolAddress;
    twaOracle.priceCumulativeSun = emptyBigIntArray(2);
    twaOracle.lastSun = ZERO_BI;
    twaOracle.priceCumulativeLast = emptyBigIntArray(2);
    twaOracle.lastBalances = emptyBigIntArray(2);
    twaOracle.lastUpdated = ZERO_BI;
    twaOracle.cumulativeWellReserves = Bytes.empty();
    twaOracle.cumulativeWellReservesTime = ZERO_BI;
    twaOracle.cumulativeWellReservesBlock = ZERO_BI;
    twaOracle.cumulativeWellReservesPrev = Bytes.empty();
    twaOracle.cumulativeWellReservesPrevTime = ZERO_BI;
    twaOracle.cumulativeWellReservesPrevBlock = ZERO_BI;
    twaOracle.save();
  }
  return twaOracle as TwaOracle;
}

export function manualTwa(poolAddress: string, newReserves: BigInt[], timestamp: BigInt): void {
  let twaOracle = loadOrCreateTwaOracle(poolAddress);
  const elapsedTime = timestamp.minus(twaOracle.lastUpdated);
  const newPriceCumulative = [
    twaOracle.priceCumulativeLast[0].plus(twaOracle.lastBalances[0].times(elapsedTime)),
    twaOracle.priceCumulativeLast[1].plus(twaOracle.lastBalances[1].times(elapsedTime))
  ];
  twaOracle.priceCumulativeLast = newPriceCumulative;
  twaOracle.lastBalances = newReserves;
  twaOracle.lastUpdated = timestamp;
  twaOracle.save();
}

export function setTwaLast(poolAddress: string, newCumulative: BigInt[], timestamp: BigInt): void {
  let twaOracle = loadOrCreateTwaOracle(poolAddress);
  twaOracle.priceCumulativeLast = newCumulative;
  twaOracle.lastUpdated = timestamp;
  twaOracle.save();
}

export function setRawWellReserves(event: WellOracle): void {
  let twaOracle = loadOrCreateTwaOracle(event.params.well.toHexString());
  twaOracle.cumulativeWellReservesPrev = twaOracle.cumulativeWellReserves;
  twaOracle.cumulativeWellReservesPrevTime = twaOracle.cumulativeWellReservesTime;
  twaOracle.cumulativeWellReservesPrevBlock = twaOracle.cumulativeWellReservesBlock;
  twaOracle.cumulativeWellReserves = event.params.cumulativeReserves;
  twaOracle.cumulativeWellReservesTime = event.block.timestamp;
  twaOracle.cumulativeWellReservesBlock = event.block.number;
  twaOracle.save();
}

// Returns the current TWA prices (balances) since the previous TwaOracle update
export function getTWAPrices(poolAddress: string, type: TWAType, timestamp: BigInt): BigInt[] {
  let twaOracle = loadOrCreateTwaOracle(poolAddress);
  const initialized = twaOracle.lastSun != ZERO_BI;

  let newPriceCumulative: BigInt[] = [];
  let twaPrices: BigInt[] = [];

  const timeElapsed = timestamp.minus(twaOracle.lastSun);
  if (type == TWAType.UNISWAP) {
    const beanPrice = uniswapCumulativePrice(Address.fromString(poolAddress), 1, timestamp);
    const pegPrice = uniswapCumulativePrice(WETH_USDC_PAIR, 0, timestamp);
    newPriceCumulative = [beanPrice, pegPrice];

    twaPrices = [
      // (priceCumulative - s.o.cumulative) / timeElapsed / 1e12 -> Decimal.ratio() which does * 1e18 / (1 << 112).
      newPriceCumulative[0].minus(twaOracle.priceCumulativeSun[0]).div(timeElapsed).times(BI_10.pow(6)).div(ONE_BI.leftShift(112)),
      newPriceCumulative[1].minus(twaOracle.priceCumulativeSun[1]).div(timeElapsed).times(BI_10.pow(6)).div(ONE_BI.leftShift(112))
    ];
  } else if (type == TWAType.CURVE) {
    // Curve
    newPriceCumulative = curveCumulativePrices(Address.fromString(poolAddress), timestamp);
    twaPrices = [
      newPriceCumulative[0].minus(twaOracle.priceCumulativeSun[0]).div(timeElapsed),
      newPriceCumulative[1].minus(twaOracle.priceCumulativeSun[1]).div(timeElapsed)
    ];
  } else if (type == TWAType.WELL_PUMP) {
    newPriceCumulative = wellCumulativePrices(Address.fromString(poolAddress), timestamp);
    twaPrices = wellTwaReserves(newPriceCumulative, twaOracle.priceCumulativeSun, new BigDecimal(timeElapsed));
  }

  // log.debug("twa prices {} | {}", [twaPrices[0].toString(), twaPrices[1].toString()]);

  twaOracle.priceCumulativeSun = newPriceCumulative;
  twaOracle.lastSun = timestamp;
  twaOracle.save();
  if (initialized) {
    return twaPrices;
  } else if (type == TWAType.UNISWAP) {
    return [BI_10.pow(18), BI_10.pow(18)];
  } else if (type == TWAType.CURVE || type == TWAType.WELL_PUMP) {
    return [BI_10.pow(6), BI_10.pow(18)];
  }
  throw new Error("[getTWAPrices] TWAType missing case");
}
