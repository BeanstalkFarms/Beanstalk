import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  BEAN_ERC20,
  BEAN_ERC20_V1,
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

export function isUnripe(token: Address): boolean {
  const unripeTokens = [UNRIPE_BEAN, UNRIPE_LP];
  for (let i = 0; i < unripeTokens.length; ++i) {
    if (unripeTokens[i] == token) {
      return true;
    }
  }
  return false;
}
