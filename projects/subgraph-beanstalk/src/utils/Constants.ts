import { BigInt, Address } from "@graphprotocol/graph-ts";
import { BEAN_ERC20, BEAN_ERC20_V1, BEANSTALK, FERTILIZER, NEW_BEAN_TOKEN_BLOCK } from "../../../subgraph-core/utils/Constants";

export function getProtocolToken(protocol: Address, blockNumber: BigInt): Address {
  if (protocol == BEANSTALK) {
    return blockNumber < NEW_BEAN_TOKEN_BLOCK ? BEAN_ERC20_V1 : BEAN_ERC20;
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
