import { BEAN_ERC20 } from "../../../subgraph-core/utils/Constants";
import { loadBean } from "../../src/entities/Bean";

export function setWhitelistedPools(pools: string[]): void {
  let bean = loadBean(BEAN_ERC20.toHexString());
  bean.pools = pools;
  bean.save();
}
