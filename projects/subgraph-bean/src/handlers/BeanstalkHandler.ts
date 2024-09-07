import { BigInt } from "@graphprotocol/graph-ts";
import { updateBeanSupplyPegPercent, updateBeanTwa } from "../utils/Bean";
import { Chop, Convert, DewhitelistToken, Reward, Sunrise } from "../../generated/Bean-ABIs/Replanted";
import { loadBean } from "../entities/Bean";
import { WellOracle } from "../../generated/Bean-ABIs/BasinBip";
import { setRawWellReserves, setTwaLast } from "../utils/price/TwaOracle";
import { decodeCumulativeWellReserves, setWellTwa } from "../utils/price/WellPrice";
import { getProtocolToken, isUnripe } from "../utils/constants/Addresses";
import { updateSeason } from "../utils/legacy/Beanstalk";
import { updatePoolPricesOnCross } from "../utils/Cross";

// Beanstalk 3 handler here, might not put this in the manifest yet - do not delete.
export function handleSunrise(event: Sunrise): void {
  updateSeason(event.params.season.toI32(), event.block);

  // Fetch price from price contract to capture any non-bean token price movevements
  // Update the current price regardless of a peg cross
  updatePoolPricesOnCross(false, event.block);
}

// Assumption is that the whitelisted token corresponds to a pool lp. If not, this method will simply do nothing.
export function handleDewhitelistToken(event: DewhitelistToken): void {
  let beanToken = getProtocolToken(event.block.number);
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
  setRawWellReserves(event);
  setTwaLast(event.params.well, decodeCumulativeWellReserves(event.params.cumulativeReserves), event.block.timestamp);
  setWellTwa(event.params.well, event.params.deltaB, event.block);
  updateBeanTwa(event.block);
}

// LOCKED BEANS //

// Locked beans are a function of the number of unripe assets, and the chop rate.
// In addition to during a swap, it should be updated according to chops, bean mints, and fertilizer purchases.
// The result of fertilizer purchases will be included by the AddLiquidity event

export function handleChop(event: Chop): void {
  let beanToken = getProtocolToken(event.block.number);
  updateBeanSupplyPegPercent(beanToken, event.block.number);
}

export function handleConvert(event: Convert): void {
  if (isUnripe(event.params.fromToken) && !isUnripe(event.params.toToken)) {
    let beanToken = getProtocolToken(event.block.number);
    updateBeanSupplyPegPercent(beanToken, event.block.number);
  }
}

export function handleRewardMint(event: Reward): void {
  let beanToken = getProtocolToken(event.block.number);
  updateBeanSupplyPegPercent(beanToken, event.block.number);
}
