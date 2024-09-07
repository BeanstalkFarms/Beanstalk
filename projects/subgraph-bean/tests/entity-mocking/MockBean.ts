import { Address } from "@graphprotocol/graph-ts";
import { BEAN_ERC20 } from "../../../subgraph-core/constants/BeanstalkEth";
import { loadBean } from "../../src/entities/Bean";
import { toBytesArray } from "../../../subgraph-core/utils/Bytes";

export function setWhitelistedPools(pools: Address[]): void {
  let bean = loadBean(BEAN_ERC20);
  bean.pools = toBytesArray(pools);
  bean.save();
}
