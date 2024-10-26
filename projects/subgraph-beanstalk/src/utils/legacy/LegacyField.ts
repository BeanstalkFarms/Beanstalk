import { Address, BigInt } from "@graphprotocol/graph-ts";
import { BEANSTALK_FARMS } from "../../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { loadField } from "../../entities/Field";

export function legacySowAmount(protocol: Address, sower: Address): BigInt | null {
  if (sower == BEANSTALK_FARMS) {
    return loadField(protocol).soil;
  }
  return null;
}
