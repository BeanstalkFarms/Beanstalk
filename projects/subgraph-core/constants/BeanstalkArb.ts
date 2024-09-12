import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  BEAN_ERC20,
  UNRIPE_BEAN,
  UNRIPE_LP,
  FERTILIZER,
  BEAN_WETH,
  BEAN_WSTETH,
  BEANSTALK_PRICE,
  RESEED_SEASON
} from "./raw/BeanstalkArbConstants";

/// ADDRESSES ///

export function getProtocolToken(): Address {
  return BEAN_ERC20;
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
  } else if (token == BEAN_WETH) {
    return 18;
  } else if (token == BEAN_WSTETH) {
    return 18;
  }
  // TODO: need to add the rest of token decimals here
  throw new Error("Unsupported token");
}

/// MILESTONE ///

export function isReplanted(): boolean {
  return true;
}

export function isGaugeDeployed(): boolean {
  return true;
}

export function getUnripeUnderlying(unripeToken: Address, blockNumber: BigInt): Address {
  if (unripeToken == UNRIPE_BEAN) {
    return BEAN_ERC20;
  } else if (unripeToken == UNRIPE_LP) {
    return BEAN_WSTETH;
  }
  throw new Error("Unsupported unripe token");
}

export function getBeanstalkPriceAddress(blockNumber: BigInt): Address {
  return BEANSTALK_PRICE;
}

export function minEMASeason(): i32 {
  return RESEED_SEASON.toI32();
}

export function stalkDecimals(): i32 {
  return 16;
}
