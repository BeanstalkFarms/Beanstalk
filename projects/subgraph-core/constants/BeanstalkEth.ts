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
  BEANSTALK_PRICE_1,
  BEANSTALK_PRICE_2,
  FERTILIZER,
  GAUGE_BIP45_BLOCK,
  NEW_BEAN_TOKEN_BLOCK,
  PRICE_2_BLOCK,
  REPLANT_SEASON,
  UNRIPE_BEAN,
  UNRIPE_LP
} from "./raw/BeanstalkEthConstants";

/// ADDRESSES ///

export function getProtocolToken(blockNumber: BigInt): Address {
  if (blockNumber < NEW_BEAN_TOKEN_BLOCK) {
    return BEAN_ERC20_V1;
  } else {
    return BEAN_ERC20;
  }
}

export function getProtocolFertilizer(): Address {
  return FERTILIZER;
}

export function getUnripeBeanAddr(): Address {
  return UNRIPE_BEAN;
}

export function getUnripeLpAddr(): Address {
  return UNRIPE_LP;
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

/// MILESTONE ///

export function isReplanted(blockNumber: BigInt): boolean {
  return blockNumber >= REPLANT_SEASON;
}

export function isGaugeDeployed(blockNumber: BigInt): boolean {
  return blockNumber >= GAUGE_BIP45_BLOCK;
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

export function getBeanstalkPriceAddress(blockNumber: BigInt): Address {
  if (blockNumber < PRICE_2_BLOCK) {
    return BEANSTALK_PRICE_1;
  } else {
    return BEANSTALK_PRICE_2;
  }
}
