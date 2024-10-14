import { Address } from "@graphprotocol/graph-ts";
import * as BeanstalkArb from "../../../subgraph-core/constants/raw/BeanstalkArbConstants";

// For the upgradeable wells used in Beanstalk 3, the BoreWell event does not indicate the proxy address.
// A manual mapping is required.
export function getActualWell(boredWell: Address): Address {
  for (let i = 0; i < mapping.length; ++i) {
    if (mapping[i].boredWells.includes(boredWell)) {
      return mapping[i].proxy;
    }
  }
  // There is no upgradeable mapping here, passthrough the bored well address
  return boredWell;
}

class UpgradeableMapping {
  proxy: Address;
  boredWells: Address[];
}

const mapping: UpgradeableMapping[] = [
  // arbitrum
  {
    proxy: BeanstalkArb.BEAN_WETH,
    boredWells: [
      Address.fromString("0x15D7A96C3DBf6B267FaE741D15c3a72f331418fE"),
      Address.fromString("0xD902f7BD849da907202d177fafC1bD39f6BBaDC4")
    ]
  },
  {
    proxy: BeanstalkArb.BEAN_WSTETH,
    boredWells: [
      Address.fromString("0x4731431430E7febd8dF6A4aA7d28867927e827A6"),
      Address.fromString("0xC49B38dFF421622628258683444F4977078CB96B")
    ]
  },
  {
    proxy: BeanstalkArb.BEAN_WEETH,
    boredWells: [
      Address.fromString("0x8DC6400022aC4304B3236F4d073053056AC24086"),
      Address.fromString("0x45F6af24e6eB8371571Dde1464A458770CbBbb65")
    ]
  },
  {
    proxy: BeanstalkArb.BEAN_WBTC,
    boredWells: [
      Address.fromString("0xB147fF6E2fD05Ad3Db185028BeB3CCe4DCb12B72"),
      Address.fromString("0xd4baA4197Aa17c7f27A2465073de33690d77Ec7E")
    ]
  },
  {
    proxy: BeanstalkArb.BEAN_USDC,
    boredWells: [
      Address.fromString("0xdC29769DB1cAA5cab41835Ef9A42BecDE80de028"),
      Address.fromString("0xEaDDD2848e962817FD565eA269a7fEDb0588b3F4")
    ]
  },
  {
    proxy: BeanstalkArb.BEAN_USDT,
    boredWells: [
      Address.fromString("0xAcFb4644B708043AD6eff1Cc323fDa374Fe6d3cE"),
      Address.fromString("0xdE8317A2A31a1684e2E4bEcedEc17700718630D8")
    ]
  }
];
