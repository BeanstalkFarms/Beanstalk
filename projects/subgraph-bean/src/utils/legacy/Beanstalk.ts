import { ethereum } from "@graphprotocol/graph-ts";
import { loadBean } from "../../entities/Bean";
import { updateBeanSeason } from "../Bean";
import { updatePoolSeason } from "../Pool";
import { toAddress } from "../../../../subgraph-core/utils/Bytes";
import { getProtocolToken } from "../../../../subgraph-core/constants/RuntimeConstants";
import { v } from "../constants/Version";

export function updateSeason(season: i32, block: ethereum.Block): void {
  let beanToken = getProtocolToken(v(), block.number);
  updateBeanSeason(beanToken, block.timestamp, season);

  let bean = loadBean(beanToken);
  for (let i = 0; i < bean.pools.length; i++) {
    updatePoolSeason(toAddress(bean.pools[i]), season, block);
  }

  for (let i = 0; i < bean.dewhitelistedPools.length; i++) {
    updatePoolSeason(toAddress(bean.dewhitelistedPools[i]), season, block);
  }
}
