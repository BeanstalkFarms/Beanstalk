import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  BEAN_3CRV,
  BEAN_ERC20,
  BEAN_WETH_CP2_WELL,
  BEAN_WETH_UNRIPE_MIGRATION_BLOCK,
  BEAN_WSTETH_CP2_WELL,
  BEAN_WSTETH_UNRIPE_MIGRATION_BLOCK,
  BEANSTALK,
  BEANSTALK_PRICE_1,
  BEANSTALK_PRICE_2,
  GAUGE_BIP45_BLOCK,
  PRICE_2_BLOCK,
  UNRIPE_BEAN,
  UNRIPE_LP
} from "../../../../subgraph-core/constants/BeanstalkEth";
import { getVersionEntity } from "./Version";

export function isGaugeDeployed(blockNumber: BigInt): boolean {
  const protocol = getVersionEntity().protocolAddress;
  if (protocol == BEANSTALK) {
    return blockNumber >= GAUGE_BIP45_BLOCK;
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeUnderlying(unripeToken: Address, blockNumber: BigInt): Address {
  const protocol = getVersionEntity().protocolAddress;
  if (protocol == BEANSTALK) {
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
  throw new Error("Unsupported protocol");
}

export function getBeanstalkPriceAddress(blockNumber: BigInt): Address {
  const protocol = getVersionEntity().protocolAddress;
  if (protocol == BEANSTALK) {
    if (blockNumber < PRICE_2_BLOCK) {
      return BEANSTALK_PRICE_1;
    } else {
      return BEANSTALK_PRICE_2;
    }
  }
  throw new Error("Unsupported protocol");
}
