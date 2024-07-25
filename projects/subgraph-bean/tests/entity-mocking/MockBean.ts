import { BigInt, Address, BigDecimal } from "@graphprotocol/graph-ts";
import { BEAN_ERC20 } from "../../../subgraph-core/utils/Constants";
import { loadBean } from "../../src/utils/Bean";

export function setWhitelistedPools(pools: string[]): void {
  let bean = loadBean(BEAN_ERC20.toHexString());
  bean.pools = pools;
  bean.save();
}
