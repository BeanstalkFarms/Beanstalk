import { BigInt, log } from "@graphprotocol/graph-ts";
import { Sunrise } from "../generated/Beanstalk/Beanstalk";
import { getBeanTokenAddress, loadBean, updateBeanSeason } from "./utils/Bean";
import { BEAN_ERC20_V1, BEAN_ERC20_V2 } from "./utils/Constants";
import { updatePoolSeason } from "./utils/Pool";

export function handleSunrise(event: Sunrise): void {
  // Update the season for hourly and daily liquidity metrics

  let beanToken = getBeanTokenAddress(event.block.number);

  updateBeanSeason(beanToken, event.block.timestamp, event.params.season.toI32());

  let bean = loadBean(beanToken);
  for (let i = 0; i < bean.pools.length; i++) {
    updatePoolSeason(bean.pools[i], event.block.timestamp, event.block.number, event.params.season.toI32());
  }
}
