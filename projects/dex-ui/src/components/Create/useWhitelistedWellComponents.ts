import { useMemo } from "react";

import { ChainId, ChainResolver } from "@beanstalk/sdk-core";

import BeanstalkFarmsLogo from "src/assets/images/beanstalk-farms.png";
import BrendanTwitterPFP from "src/assets/images/brendan-twitter-pfp.png";
import ClockIcon from "src/assets/images/clock-icon.svg";
import Code4renaLogo from "src/assets/images/code4rena-logo.png";
import CyrfinLogo from "src/assets/images/cyrfin-logo.svg";
import HalbornLogo from "src/assets/images/halborn-logo.png";
import { AddressMap } from "src/types";
import { toAddressMap } from "src/utils/addresses";
import useSdk from "src/utils/sdk/useSdk";
import { usePumps } from "src/wells/pump/usePumps";
import { useWellImplementations } from "src/wells/useWellImplementations";
import { useWells } from "src/wells/useWells";
import { useWellFunctions } from "src/wells/wellFunction/useWellFunctions";

export enum WellComponentType {
  WellImplementation = "WellImplementation",
  Pump = "Pump",
  WellFunction = "WellFunction"
}

type BaseInfo = {
  value: string;
  imgSrc?: string;
  url?: string;
};

type ComponentInfo = Omit<BaseInfo, "value"> & {
  label: string;
  value: string | BaseInfo[];
};

export type WellComponentInfo = {
  address: string;
  component: {
    name: string;
    fullName?: string;
    summary: string;
    description: string[];
    url?: string;
    usedBy: number;
    type: {
      type: WellComponentType;
      display: string;
      imgSrc?: string;
    };
  };
  info: ComponentInfo[];
  links: {
    explorer?: string;
    // arbiscan?: string;
    // etherscan?: string;
    github?: string;
    learnMore?: string;
  };
};

const code4ArenaAuditLink = "https://code4rena.com/reports/2023-07-basin";
const halbornAuditLink =
  "https://github.com/BeanstalkFarms/Beanstalk-Audits/blob/main/ecosystem/06-16-23-basin-halborn-report.pdf";
const cyfrinAuditLink =
  "https://github.com/BeanstalkFarms/Beanstalk-Audits/blob/main/ecosystem/06-16-23-basin-cyfrin-report.pdf";

const basinAuditInfo = [
  {
    value: "Cyfrin",
    imgSrc: CyrfinLogo,
    url: cyfrinAuditLink
  },
  {
    value: "Halborn",
    imgSrc: HalbornLogo,
    url: halbornAuditLink
  },
  {
    value: "Code4rena",
    imgSrc: Code4renaLogo,
    url: code4ArenaAuditLink
  }
];

const WellDotSol: WellComponentInfo = {
  address: "",
  component: {
    name: "Well.sol",
    summary: "A standard Well implementation that prioritizes flexibility and composability.",
    description: [
      "A standard Well implementation that prioritizes flexibility and composability.",
      "Fits many use cases for a Well."
    ],
    usedBy: 0,
    type: {
      type: WellComponentType.WellImplementation,
      display: "💧 Well Implementation"
    },
    url: "https://github.com/BeanstalkFarms/Basin/blob/master/src/Well.sol"
  },
  info: [
    { label: "Deployed By", value: "Beanstalk Farms", imgSrc: BeanstalkFarmsLogo },
    { label: "Block Deployed", value: "17977943" },
    { label: "Audited by", value: basinAuditInfo }
  ],
  links: {
    github: "https://github.com/BeanstalkFarms/Basin/blob/master/src/Well.sol",
    learnMore: "https://github.com/BeanstalkFarms/Basin/blob/master/src/Well.sol"
  }
};

const MultiFlowPump: WellComponentInfo = {
  address: "",
  component: {
    name: "Multi Flow",
    fullName: "Multi Flow Pump V1.1",
    summary: "An inter-block MEV manipulation resistant oracle implementation.",
    description: [
      "Comprehensive multi-block MEV manipulation-resistant oracle implementation which serves up Well pricing data with an EMA for instantaneous prices and a TWAP for weighted averages over time."
    ],
    usedBy: 0,
    url: "https://docs.basin.exchange/implementations/multi-flow-pump",
    type: {
      type: WellComponentType.Pump,
      display: "🔮 Pump"
    }
  },
  info: [
    {
      label: "Deployed By",
      value: "Brendan Sanderson",
      imgSrc: BrendanTwitterPFP,
      url: "https://github.com/BrendanSanderson"
    },
    { label: "Deployed Block", value: "17977942" },
    { label: "Audited by", value: basinAuditInfo }
  ],
  links: {
    github: "https://github.com/BeanstalkFarms/Basin/blob/master/src/pumps/MultiFlowPump.sol",
    learnMore: "https://github.com/BeanstalkFarms/Basin/blob/master/src/pumps/MultiFlowPump.sol"
  }
};

const ConstantProduct2: WellComponentInfo = {
  address: "",
  component: {
    name: "Constant Product 2",
    summary: "A standard x*y = k token pricing function for two tokens.",
    description: ["A standard x*y = k token pricing function for two tokens."],
    url: "https://github.com/BeanstalkFarms/Basin/blob/master/src/functions/ConstantProduct2.sol",
    type: {
      type: WellComponentType.WellFunction,
      display: "Well Function",
      imgSrc: ClockIcon
    },
    usedBy: 0
  },
  info: [
    { label: "Deployed By", value: "Beanstalk Farms", imgSrc: BeanstalkFarmsLogo },
    { label: "Deployed Block", value: "17977906" },
    { label: "Audited by", value: basinAuditInfo }
  ],
  links: {
    github:
      "https://github.com/BeanstalkFarms/Basin/blob/master/src/functions/ConstantProduct2.sol",
    learnMore:
      "https://github.com/BeanstalkFarms/Basin/blob/master/src/functions/ConstantProduct2.sol"
  }
};

type WellComponentMap<T> = {
  wellImplementations: T;
  pumps: T;
  wellFunctions: T;
};

const getComponentWithUpdateLinks = (
  wellComponent: WellComponentInfo,
  chainId: ChainId,
  address: string
) => {
  const explorer = `https://${ChainResolver.isL2Chain(chainId) ? "arbiscan" : "etherscan"}.io/address/${address}`;

  return {
    ...wellComponent,
    address,
    links: {
      ...wellComponent.links,
      explorer
    }
  };
};

export const useWhitelistedWellComponents = () => {
  const { data: wells } = useWells();
  const { data: implementations } = useWellImplementations();
  const wellFunctions = useWellFunctions();
  const pumps = usePumps();
  const sdk = useSdk();

  const whitelist = useMemo(() => {
    // set Addresses
    const wellDotSol = getComponentWithUpdateLinks(
      WellDotSol,
      sdk.chainId,
      sdk.wells.addresses.WELL_DOT_SOL.get(sdk.chainId)
    );
    const multiFlow = getComponentWithUpdateLinks(
      MultiFlowPump,
      sdk.chainId,
      sdk.wells.addresses.MULTI_FLOW_PUMP_V1_1.get(sdk.chainId)
    );
    const cp2 = getComponentWithUpdateLinks(
      ConstantProduct2,
      sdk.chainId,
      sdk.wells.addresses.CONSTANT_PRODUCT_2_V2.get(sdk.chainId)
    );

    return {
      wellImplementations: {
        [wellDotSol.address]: wellDotSol
      },
      pumps: {
        [multiFlow.address]: multiFlow
      },
      wellFunctions: {
        [cp2.address]: cp2
      }
    };
  }, [sdk]);

  return useMemo(() => {
    // make deep copy of ComponentWhiteList
    const map = JSON.parse(JSON.stringify(whitelist)) as WellComponentMap<
      AddressMap<WellComponentInfo>
    >;

    const pumpMap = toAddressMap(pumps, { keyLowercase: true });
    const wellFunctionMap = toAddressMap(wellFunctions, { keyLowercase: true });

    for (const well of wells || []) {
      // increase usedBy count for each whitelisted well component
      if (implementations) {
        const implementation = implementations[well.address.toLowerCase()];
        if (implementation in map.wellImplementations) {
          map.wellImplementations[implementation].component.usedBy += 1;
        }
      }

      well.pumps?.forEach((pump) => {
        const pumpAddress = pump.address.toLowerCase();
        if (pumpAddress in pumpMap && pumpAddress in map.pumps) {
          map.pumps[pumpAddress].component.usedBy += 1;
        }
      });

      if (well.wellFunction) {
        const wellFunctionAddress = well.wellFunction.address.toLowerCase();
        if (wellFunctionAddress in wellFunctionMap && wellFunctionAddress in map.wellFunctions) {
          map.wellFunctions[wellFunctionAddress].component.usedBy += 1;
        }
      }
    }

    const components: WellComponentMap<WellComponentInfo[]> = {
      wellImplementations: Object.values(map.wellImplementations),
      pumps: Object.values(map.pumps),
      wellFunctions: Object.values(map.wellFunctions)
    };

    return {
      components,
      lookup: map
    };
  }, [whitelist, implementations, pumps, wellFunctions, wells]);
};
