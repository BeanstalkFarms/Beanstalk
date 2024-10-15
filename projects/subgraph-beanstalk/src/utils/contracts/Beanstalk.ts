import { BigInt } from "@graphprotocol/graph-ts";
import { BEANSTALK as BEANSTALK_ETH } from "../../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { SeedGauge } from "../../../generated/Beanstalk-ABIs/SeedGauge";
import { v } from "../constants/Version";
import { BEANSTALK as BEANSTALK_ARB } from "../../../../subgraph-core/constants/raw/BeanstalkArbConstants";
import { Reseed } from "../../../generated/Beanstalk-ABIs/Reseed";

export function Beanstalk_harvestableIndex(fieldId: BigInt): BigInt {
  const version = v();
  if (version.chain == "ethereum" && version.protocolAddress == BEANSTALK_ETH) {
    let beanstalk_contract = SeedGauge.bind(version.protocolAddress);
    return beanstalk_contract.harvestableIndex();
  } else if (version.chain == "arbitrum" && version.protocolAddress == BEANSTALK_ARB) {
    let beanstalk_contract = Reseed.bind(version.protocolAddress);
    return beanstalk_contract.harvestableIndex(fieldId);
  }
  throw new Error("Unsupported protocol");
}
