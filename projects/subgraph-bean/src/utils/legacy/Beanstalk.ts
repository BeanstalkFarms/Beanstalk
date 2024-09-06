import { ethereum } from "@graphprotocol/graph-ts";
import { loadBean } from "../../entities/Bean";
import { updateBeanSeason } from "../Bean";
import { getProtocolToken } from "../constants/Addresses";
import { updatePoolSeason } from "../Pool";
import { toAddress } from "../../../../subgraph-core/utils/Bytes";

export function updateSeason(season: i32, block: ethereum.Block): void {
  let beanToken = getProtocolToken(block.number);
  updateBeanSeason(beanToken, block.timestamp, season);

  let bean = loadBean(beanToken);
  for (let i = 0; i < bean.pools.length; i++) {
    updatePoolSeason(toAddress(bean.pools[i]), season, block);
  }

  for (let i = 0; i < bean.dewhitelistedPools.length; i++) {
    updatePoolSeason(toAddress(bean.dewhitelistedPools[i]), season, block);
  }
}
