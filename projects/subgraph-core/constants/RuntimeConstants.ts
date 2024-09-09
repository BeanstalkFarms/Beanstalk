import { Address, BigInt } from "@graphprotocol/graph-ts";
import { BEANSTALK } from "./raw/BeanstalkEthConstants";
import * as BeanstalkEth from "./BeanstalkEth";

/// Used to determine the appropriate constants for subgraphs at runtime ///

export class VersionDto {
  subgraphName: string;
  versionNumber: string;
  protocolAddress: Address;
  chain: string;
}

export function getProtocolToken(v: VersionDto, blockNumber: BigInt): Address {
  if (v.chain == "ethereum" && v.protocolAddress == BEANSTALK) {
    return BeanstalkEth.getProtocolToken(blockNumber);
  }
  throw new Error("Unsupported protocol");
}

export function getProtocolFertilizer(v: VersionDto): Address | null {
  if (v.chain == "ethereum" && v.protocolAddress == BEANSTALK) {
    return BeanstalkEth.getProtocolFertilizer();
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeBeanAddr(v: VersionDto): Address {
  if (v.chain == "ethereum" && v.protocolAddress == BEANSTALK) {
    return BeanstalkEth.getUnripeBeanAddr();
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeLpAddr(v: VersionDto): Address {
  if (v.chain == "ethereum" && v.protocolAddress == BEANSTALK) {
    return BeanstalkEth.getUnripeLpAddr();
  }
  throw new Error("Unsupported protocol");
}

export function isUnripe(v: VersionDto, token: Address): boolean {
  if (v.chain == "ethereum" && v.protocolAddress == BEANSTALK) {
    return BeanstalkEth.isUnripe(token);
  }
  throw new Error("Unsupported protocol");
}

export function getTokenDecimals(v: VersionDto, token: Address): i32 {
  if (v.chain == "ethereum" && v.protocolAddress == BEANSTALK) {
    return BeanstalkEth.getTokenDecimals(token);
  }
  throw new Error("Unsupported protocol");
}

/// MILESTONE ///

export function isGaugeDeployed(v: VersionDto, blockNumber: BigInt): boolean {
  if (v.chain == "ethereum" && v.protocolAddress == BEANSTALK) {
    return BeanstalkEth.isGaugeDeployed(blockNumber);
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeUnderlying(v: VersionDto, unripeToken: Address, blockNumber: BigInt): Address {
  if (v.chain == "ethereum" && v.protocolAddress == BEANSTALK) {
    return BeanstalkEth.getUnripeUnderlying(unripeToken, blockNumber);
  }
  throw new Error("Unsupported protocol");
}

export function getBeanstalkPriceAddress(v: VersionDto, blockNumber: BigInt): Address {
  if (v.chain == "ethereum" && v.protocolAddress == BEANSTALK) {
    return BeanstalkEth.getBeanstalkPriceAddress(blockNumber);
  }
  throw new Error("Unsupported protocol");
}
