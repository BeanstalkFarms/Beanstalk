import { BigInt, Address, BigDecimal } from "@graphprotocol/graph-ts";
import { BI_10, ONE_BI, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { uniswapCumulativePrice } from "./UniswapPrice";
import { WETH_USDC_PAIR } from "../../../../subgraph-core/utils/Constants";
import { curveCumulativePrices } from "./CurvePrice";
import { TWAType } from "./Types";
import { wellCumulativePrices, wellTwaReserves } from "./WellPrice";
import { WellOracle } from "../../../generated/Bean-ABIs/BasinBip";
import { loadOrCreateTwaOracle } from "../../entities/TwaOracle";

export function manualTwa(poolAddress: Address, newReserves: BigInt[], timestamp: BigInt): void {
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

export function setTwaLast(poolAddress: Address, newCumulative: BigInt[], timestamp: BigInt): void {
  let twaOracle = loadOrCreateTwaOracle(poolAddress);
  twaOracle.priceCumulativeLast = newCumulative;
  twaOracle.lastUpdated = timestamp;
  twaOracle.save();
}

export function setRawWellReserves(event: WellOracle): void {
  let twaOracle = loadOrCreateTwaOracle(event.params.well);
  twaOracle.cumulativeWellReservesPrev = twaOracle.cumulativeWellReserves;
  twaOracle.cumulativeWellReservesPrevTime = twaOracle.cumulativeWellReservesTime;
  twaOracle.cumulativeWellReservesPrevBlock = twaOracle.cumulativeWellReservesBlock;
  twaOracle.cumulativeWellReserves = event.params.cumulativeReserves;
  twaOracle.cumulativeWellReservesTime = event.block.timestamp;
  twaOracle.cumulativeWellReservesBlock = event.block.number;
  twaOracle.save();
}

// Returns the current TWA prices (balances) since the previous TwaOracle update
export function getTWAPrices(poolAddress: Address, type: TWAType, timestamp: BigInt): BigInt[] {
  let twaOracle = loadOrCreateTwaOracle(poolAddress);
  const initialized = twaOracle.lastSun != ZERO_BI;

  let newPriceCumulative: BigInt[] = [];
  let twaPrices: BigInt[] = [];

  const timeElapsed = timestamp.minus(twaOracle.lastSun);
  if (type == TWAType.UNISWAP) {
    const beanPrice = uniswapCumulativePrice(poolAddress, 1, timestamp);
    const pegPrice = uniswapCumulativePrice(WETH_USDC_PAIR, 0, timestamp);
    newPriceCumulative = [beanPrice, pegPrice];

    twaPrices = [
      // (priceCumulative - s.o.cumulative) / timeElapsed / 1e12 -> Decimal.ratio() which does * 1e18 / (1 << 112).
      newPriceCumulative[0].minus(twaOracle.priceCumulativeSun[0]).div(timeElapsed).times(BI_10.pow(6)).div(ONE_BI.leftShift(112)),
      newPriceCumulative[1].minus(twaOracle.priceCumulativeSun[1]).div(timeElapsed).times(BI_10.pow(6)).div(ONE_BI.leftShift(112))
    ];
  } else if (type == TWAType.CURVE) {
    // Curve
    newPriceCumulative = curveCumulativePrices(poolAddress, timestamp);
    twaPrices = [
      newPriceCumulative[0].minus(twaOracle.priceCumulativeSun[0]).div(timeElapsed),
      newPriceCumulative[1].minus(twaOracle.priceCumulativeSun[1]).div(timeElapsed)
    ];
  } else if (type == TWAType.WELL_PUMP) {
    newPriceCumulative = wellCumulativePrices(poolAddress, timestamp);
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
