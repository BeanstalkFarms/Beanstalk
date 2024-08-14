import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  BEAN_3CRV,
  BEAN_3CRV_V1,
  BEAN_ERC20,
  BEAN_ERC20_V1,
  BEAN_LUSD_V1,
  BEAN_WETH_CP2_WELL,
  BEAN_WETH_UNRIPE_MIGRATION_BLOCK,
  BEAN_WETH_V1,
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

export function getTokenDecimals(token: Address): i32 {
  if (token == BEAN_ERC20) {
    return 6;
  } else if (token == UNRIPE_BEAN) {
    return 6;
  } else if (token == UNRIPE_LP) {
    return 6;
  } else if (token == BEAN_3CRV) {
    return 18;
  } else if (token == BEAN_WETH_CP2_WELL) {
    return 18;
  } else if (token == BEAN_WSTETH_CP2_WELL) {
    return 18;
  } else if (token == BEAN_ERC20_V1) {
    return 6;
  } else if (token == BEAN_WETH_V1) {
    return 18;
  } else if (token == BEAN_3CRV_V1) {
    return 18;
  } else if (token == BEAN_LUSD_V1) {
    return 18;
  }
  throw new Error("Unsupported token");
}
