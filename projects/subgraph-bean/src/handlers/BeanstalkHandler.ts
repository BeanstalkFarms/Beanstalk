import { BigInt } from "@graphprotocol/graph-ts";
import { updateBeanSupplyPegPercent, updateBeanTwa } from "../utils/Bean";
import { Chop, Convert, DewhitelistToken, Shipped, Sunrise, WellOracle } from "../../generated/Bean-ABIs/Reseed";
import { loadBean } from "../entities/Bean";
import { setRawWellReserves, setTwaLast } from "../utils/price/TwaOracle";
import { decodeCumulativeWellReserves, setWellTwa } from "../utils/price/WellPrice";
import { updateSeason } from "../utils/legacy/Beanstalk";
import { updatePoolPricesOnCross } from "../utils/Cross";
import { beanDecimals, getProtocolToken, isUnripe } from "../../../subgraph-core/constants/RuntimeConstants";
import { v } from "../utils/constants/Version";
import { loadOrCreatePool } from "../entities/Pool";
import { BI_10 } from "../../../subgraph-core/utils/Decimals";

// Beanstalk 3 handler here, might not put this in the manifest yet - do not delete.
export function handleSunrise(event: Sunrise): void {
  updateSeason(event.params.season.toI32(), event.block);

  // Fetch price from price contract to capture any non-bean token price movevements
  // Update the current price regardless of a peg cross
  updatePoolPricesOnCross(false, event.block);
}

// Assumption is that the whitelisted token corresponds to a pool lp. If not, this method will simply do nothing.
export function handleDewhitelistToken(event: DewhitelistToken): void {
  let beanToken = getProtocolToken(v(), event.block.number);
  let bean = loadBean(beanToken);
  let index = bean.pools.indexOf(event.params.token);
  if (index >= 0) {
    const newPools = bean.pools;
    const newDewhitelistedPools = bean.dewhitelistedPools;
    newDewhitelistedPools.push(newPools.splice(index, 1)[0]);
    bean.pools = newPools;
    bean.dewhitelistedPools = newDewhitelistedPools;
    bean.save();
  }
}

// POST REPLANT TWA DELTAB //

export function handleWellOracle(event: WellOracle): void {
  if (event.params.cumulativeReserves.length == 0) {
    // Ignore emissions for wells with uninitialized reserves
    return;
  }
  setRawWellReserves(event);
  setTwaLast(event.params.well, decodeCumulativeWellReserves(event.params.cumulativeReserves), event.block.timestamp);

  // Ignore deltaB processing for wells with fewer than 1k beans (contract always reports zero)
  const pool = loadOrCreatePool(event.params.well, event.block.number);
  const beanIndex = pool.tokens.indexOf(getProtocolToken(v(), event.block.number));
  if (pool.reserves[beanIndex] > BigInt.fromU32(1000).times(BI_10.pow(<u8>beanDecimals()))) {
    setWellTwa(event.params.well, event.params.deltaB, event.block);
    updateBeanTwa(event.block);
  }
}

// LOCKED BEANS //

// Locked beans are a function of the number of unripe assets, and the chop rate.
// In addition to during a swap, it should be updated according to chops, bean mints, and fertilizer purchases.
// The result of fertilizer purchases will be included by the AddLiquidity event

export function handleChop(event: Chop): void {
  let beanToken = getProtocolToken(v(), event.block.number);
  updateBeanSupplyPegPercent(beanToken, event.block.number);
}

export function handleConvert(event: Convert): void {
  if (isUnripe(v(), event.params.fromToken) && !isUnripe(v(), event.params.toToken)) {
    let beanToken = getProtocolToken(v(), event.block.number);
    updateBeanSupplyPegPercent(beanToken, event.block.number);
  }
}

// Overall reward mint
export function handleShipped(event: Shipped): void {
  let beanToken = getProtocolToken(v(), event.block.number);
  updateBeanSupplyPegPercent(beanToken, event.block.number);
}
