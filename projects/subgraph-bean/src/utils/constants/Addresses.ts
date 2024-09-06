import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  BEAN_3CRV,
  BEAN_ERC20,
  BEAN_ERC20_V1,
  BEAN_WETH_CP2_WELL,
  BEAN_WETH_UNRIPE_MIGRATION_BLOCK,
  BEAN_WSTETH_CP2_WELL,
  BEAN_WSTETH_UNRIPE_MIGRATION_BLOCK,
  BEANSTALK,
  NEW_BEAN_TOKEN_BLOCK,
  UNRIPE_BEAN,
  UNRIPE_LP
} from "../../../../subgraph-core/utils/Constants";
import { getVersionEntity } from "./Version";

export function getProtocolToken(blockNumber: BigInt): Address {
  const protocol = getVersionEntity().protocolAddress;
  if (protocol == BEANSTALK) {
    if (blockNumber < NEW_BEAN_TOKEN_BLOCK) {
      return BEAN_ERC20_V1;
    } else {
      return BEAN_ERC20;
    }
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeBeanAddr(): Address {
  const protocol = getVersionEntity().protocolAddress;
  if (protocol == BEANSTALK) {
    return UNRIPE_BEAN;
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeLpAddr(): Address {
  const protocol = getVersionEntity().protocolAddress;
  if (protocol == BEANSTALK) {
    return UNRIPE_LP;
  }
  throw new Error("Unsupported protocol");
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

export function isUnripe(token: Address): boolean {
  const unripeTokens = [getUnripeBeanAddr(), getUnripeLpAddr()];
  for (let i = 0; i < unripeTokens.length; ++i) {
    if (unripeTokens[i] == token) {
      return true;
    }
  }
  return false;
}
