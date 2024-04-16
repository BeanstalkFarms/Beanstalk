import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import { TwaOracle } from "../../../generated/schema";
import { BI_10, emptyBigIntArray, ONE_BI, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { uniswapCumulativePrice } from "./UniswapPrice";
import { WETH_USDC_PAIR } from "../../../../subgraph-core/utils/Constants";

export enum TWAType {
  UNISWAP,
  CURVE
}

export function loadOrCreateTwaOracle(poolAddress: string): TwaOracle {
  let twaOracle = TwaOracle.load(poolAddress);
  if (twaOracle == null) {
    twaOracle = new TwaOracle(poolAddress);
    twaOracle.pool = poolAddress;
    twaOracle.priceCumulativeLast = emptyBigIntArray(2);
    twaOracle.lastUpdated = ZERO_BI;
    twaOracle.save();
  }
  return twaOracle as TwaOracle;
}

// Returns the current TWA prices since the previous TwaOracle update
export function getTWAPrices(poolAddress: string, type: TWAType, timestamp: BigInt): BigInt[] {
  let twaOracle = loadOrCreateTwaOracle(poolAddress);
  const initialized = twaOracle.lastUpdated != ZERO_BI;
  let newPriceCumulative: BigInt[] = [];

  if (type == TWAType.UNISWAP) {
    const beanPrice = uniswapCumulativePrice(Address.fromString(poolAddress), 1, timestamp);
    const pegPrice = uniswapCumulativePrice(WETH_USDC_PAIR, 0, timestamp);
    newPriceCumulative = [beanPrice, pegPrice];
  } else {
    // TODO Curve
  }

  const timeElapsed = timestamp.minus(twaOracle.lastUpdated);
  const twaPrices = [
    newPriceCumulative[0].minus(twaOracle.priceCumulativeLast[0]).div(timeElapsed).div(BI_10.pow(12)),
    newPriceCumulative[1].minus(twaOracle.priceCumulativeLast[1]).div(timeElapsed).div(BI_10.pow(12))
  ];

  twaOracle.priceCumulativeLast = newPriceCumulative;
  twaOracle.lastUpdated = timestamp;
  twaOracle.save();
  return initialized ? twaPrices : [ONE_BI, ONE_BI];
}
