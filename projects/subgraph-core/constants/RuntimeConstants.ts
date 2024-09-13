import { Address, BigInt } from "@graphprotocol/graph-ts";
import * as ConstantsEth from "./raw/BeanstalkEthConstants";
import * as BeanstalkEth from "./BeanstalkEth";
import * as ConstantsArb from "./raw/BeanstalkArbConstants";
import * as BeanstalkArb from "./BeanstalkArb";

/// Used to determine the appropriate constants for subgraphs at runtime ///

export class VersionDto {
  subgraphName: string;
  versionNumber: string;
  protocolAddress: Address;
  chain: string;
}

export function getProtocolToken(v: VersionDto, blockNumber: BigInt): Address {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.getProtocolToken(blockNumber);
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.getProtocolToken();
  }
  throw new Error("Unsupported protocol");
}

export function getProtocolFertilizer(v: VersionDto): Address | null {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.getProtocolFertilizer();
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkEth.getProtocolFertilizer();
  }
  throw new Error("Unsupported protocol");
}

export function getAquifer(v: VersionDto): Address {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.getAquifer();
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkEth.getAquifer();
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeBeanAddr(v: VersionDto): Address {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.getUnripeBeanAddr();
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.getUnripeBeanAddr();
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeLpAddr(v: VersionDto): Address {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.getUnripeLpAddr();
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.getUnripeLpAddr();
  }
  throw new Error("Unsupported protocol");
}

export function isUnripe(v: VersionDto, token: Address): boolean {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.isUnripe(token);
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.isUnripe(token);
  }
  throw new Error("Unsupported protocol");
}

export function getTokenDecimals(v: VersionDto, token: Address): i32 {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.getTokenDecimals(token);
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.getTokenDecimals(token);
  }
  throw new Error("Unsupported protocol");
}

/// MILESTONE ///

export function isReplanted(v: VersionDto, blockNumber: BigInt): boolean {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.isReplanted(blockNumber);
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.isReplanted();
  }
  throw new Error("Unsupported protocol");
}

export function isGaugeDeployed(v: VersionDto, blockNumber: BigInt): boolean {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.isGaugeDeployed(blockNumber);
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.isGaugeDeployed();
  }
  throw new Error("Unsupported protocol");
}

export function getUnripeUnderlying(v: VersionDto, unripeToken: Address, blockNumber: BigInt): Address {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.getUnripeUnderlying(unripeToken, blockNumber);
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.getUnripeUnderlying(unripeToken, blockNumber);
  }
  throw new Error("Unsupported protocol");
}

export function getBeanstalkPriceAddress(v: VersionDto, blockNumber: BigInt): Address {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.getBeanstalkPriceAddress(blockNumber);
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.getBeanstalkPriceAddress(blockNumber);
  }
  throw new Error("Unsupported protocol");
}

export function minEMASeason(v: VersionDto): i32 {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.minEMASeason();
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.minEMASeason();
  }
  throw new Error("Unsupported protocol");
}

export function stalkDecimals(v: VersionDto): i32 {
  if (v.chain == "ethereum" && v.protocolAddress == ConstantsEth.BEANSTALK) {
    return BeanstalkEth.stalkDecimals();
  } else if (v.chain == "arbitrum" && v.protocolAddress == ConstantsArb.BEANSTALK) {
    return BeanstalkArb.stalkDecimals();
  }
  throw new Error("Unsupported protocol");
}

export function beanDecimals(): i32 {
  return 6;
}
