import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  BEAN_3CRV,
  BEAN_ERC20,
  BEAN_WETH_CP2_WELL,
  BEAN_WETH_UNRIPE_MIGRATION_BLOCK,
  BEAN_WSTETH_CP2_WELL,
  BEAN_WSTETH_UNRIPE_MIGRATION_BLOCK,
  BEANSTALK,
  FERTILIZER,
  UNRIPE_BEAN,
  UNRIPE_LP
} from "../../../subgraph-core/utils/Constants";

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

export function getUnripeUnderlying(unripeToken: Address, blockNumber: BigInt): Address {
  if (unripeToken == UNRIPE_BEAN) {
    return BEAN_ERC20;
  } else if (unripeToken == UNRIPE_LP) {
    if (blockNumber < BEAN_WETH_UNRIPE_MIGRATION_BLOCK) {
      return BEAN_3CRV;
    } else if (blockNumber < BEAN_WSTETH_UNRIPE_MIGRATION_BLOCK) {
      return BEAN_WETH_CP2_WELL;
    } else {
      return BEAN_WSTETH_CP2_WELL;
    }
  }
  throw new Error("Unsupported unripe token");
}
