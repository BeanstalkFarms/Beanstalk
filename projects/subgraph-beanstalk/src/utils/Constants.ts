import { Address } from "@graphprotocol/graph-ts";
import { BEAN_ERC20, BEANSTALK, FERTILIZER } from "../../../subgraph-core/utils/Constants";

export function getProtocolToken(protocol: Address): Address {
  if (protocol == BEANSTALK) {
    return BEAN_ERC20;
  }
  throw new Error("Unsupported protocol");
}

export function getProtocolFertilizer(protocol: Address): Address | null {
  if (protocol == BEANSTALK) {
    return FERTILIZER;
  }
  throw new Error("Unsupported protocol");
}

export function getFertilizerProtocol(fertilizer: Address): Address {
  if (fertilizer == FERTILIZER) {
    return BEANSTALK;
  }
  throw new Error("Unsupported fertilizer");
}
