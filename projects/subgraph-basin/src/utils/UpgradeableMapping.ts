import { Address } from "@graphprotocol/graph-ts";
import * as BeanstalkArb from "../../../subgraph-core/constants/raw/BeanstalkArbConstants";

// For the upgradeable wells used in Beanstalk 3, the BoreWell event does not indicate the proxy address.
// A manual mapping is required.
export function getActualWell(boredWell: Address): Address {
  for (let i = 0; i < mapping.length; ++i) {
    if (mapping[i].boredWell == boredWell) {
      return mapping[i].proxy;
    }
  }
  // There is no upgradeable mapping here, passthrough the bored well address
  return boredWell;
}

class UpgradeableMapping {
  proxy: Address;
  boredWell: Address;
}

const mapping: UpgradeableMapping[] = [
  // arbitrum
  {
    proxy: BeanstalkArb.BEAN_WETH,
    boredWell: Address.fromString("0x15D7A96C3DBf6B267FaE741D15c3a72f331418fE")
  },
  {
    proxy: BeanstalkArb.BEAN_WSTETH,
    boredWell: Address.fromString("0x4731431430E7febd8dF6A4aA7d28867927e827A6")
  },
  {
    proxy: BeanstalkArb.BEAN_WEETH,
    boredWell: Address.fromString("0x8DC6400022aC4304B3236F4d073053056AC24086")
  },
  {
    proxy: BeanstalkArb.BEAN_WBTC,
    boredWell: Address.fromString("0xB147fF6E2fD05Ad3Db185028BeB3CCe4DCb12B72")
  },
  {
    proxy: BeanstalkArb.BEAN_USDC,
    boredWell: Address.fromString("0xdC29769DB1cAA5cab41835Ef9A42BecDE80de028")
  },
  {
    proxy: BeanstalkArb.BEAN_USDT,
    boredWell: Address.fromString("0xAcFb4644B708043AD6eff1Cc323fDa374Fe6d3cE")
  }
];
