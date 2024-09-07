import { BigInt, Address } from "@graphprotocol/graph-ts";
import * as BeanstalkEth from "../../../../subgraph-core/constants/BeanstalkEth";
import { getVersionEntity } from "./Version";

export function getProtocolToken(blockNumber: BigInt): Address {
  const protocol = getVersionEntity().protocolAddress;
  if (protocol == BeanstalkEth.BEANSTALK) {
    if (blockNumber < BeanstalkEth.NEW_BEAN_TOKEN_BLOCK) {
      return BeanstalkEth.BEAN_ERC20_V1;
    } else {
      return BeanstalkEth.BEAN_ERC20;
    }
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeBeanAddr(): Address {
  const protocol = getVersionEntity().protocolAddress;
  if (protocol == BeanstalkEth.BEANSTALK) {
    return BeanstalkEth.UNRIPE_BEAN;
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeLpAddr(): Address {
  const protocol = getVersionEntity().protocolAddress;
  if (protocol == BeanstalkEth.BEANSTALK) {
    return BeanstalkEth.UNRIPE_LP;
  }
  throw new Error("Unsupported protocol");
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
