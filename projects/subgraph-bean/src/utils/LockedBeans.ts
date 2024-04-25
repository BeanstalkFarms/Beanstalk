import { BigDecimal, BigInt, log } from "@graphprotocol/graph-ts";
import { BEANSTALK } from "../../../subgraph-core/utils/Constants";
import { SeedGauge } from "../../generated/Beanstalk/SeedGauge";
import { ONE_BI } from "../../../subgraph-core/utils/Decimals";

export function calcLockedBeans(): BigInt {
  // If BIP42 is deployed - return the result from the contract
  let beanstalk = SeedGauge.bind(BEANSTALK);
  let lockedBeans = beanstalk.try_getLockedBeans();
  if (!lockedBeans.reverted) {
    return lockedBeans.value;
  }

  // Pre-gauge there was no lockedBeans contract function, instead we recreate the same calculation.
  // TODO
  return ONE_BI;
}
