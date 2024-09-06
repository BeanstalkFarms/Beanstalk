import { ethereum } from "@graphprotocol/graph-ts";
import { BEAN_ERC20 } from "../../../../subgraph-core/utils/Constants";
import { BEAN_INITIAL_VALUES } from "../../../cache-builder/results/BeanInit_arb";
import { loadBean, loadOrCreateBeanDailySnapshot, loadOrCreateBeanHourlySnapshot } from "../../entities/Bean";

export function handleInitBeanEntity(block: ethereum.Block): void {
  // TODO: how to determine correct token address? this is wrong
  const token = BEAN_ERC20;
  const bean = loadBean(token);

  bean.volume = BEAN_INITIAL_VALUES.volume;
  bean.volumeUSD = BEAN_INITIAL_VALUES.volumeUsd;
  bean.crosses = BEAN_INITIAL_VALUES.crosses;
  bean.lastCross = BEAN_INITIAL_VALUES.lastCross;
  bean.lastSeason = BEAN_INITIAL_VALUES.lastSeason;
  bean.save();
  // No need to initialize supply/price etc as those will be initialized when liquidity is added.

  // Direct assignment for snapshots is preferable as to avoid large deltas
  const beanHourly = loadOrCreateBeanHourlySnapshot(token, block.timestamp, bean.lastSeason);
  beanHourly.volume = bean.volume;
  beanHourly.volumeUSD = bean.volumeUSD;
  beanHourly.crosses = bean.crosses;
  beanHourly.save();

  const beanDaily = loadOrCreateBeanDailySnapshot(token, block.timestamp);
  beanDaily.volume = bean.volume;
  beanDaily.volumeUSD = bean.volumeUSD;
  beanDaily.crosses = bean.crosses;
  beanDaily.save();
}
