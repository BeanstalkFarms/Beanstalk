import { useMemo } from "react";
import BeanstalkFarmsLogo from "src/assets/images/beanstalk-farms.png";
import HalbornLogo from "src/assets/images/halborn-logo.png";
import {
  MULTI_FLOW_PUMP_ADDRESS,
  CONSTANT_PRODUCT_2_ADDRESS,
  WELL_DOT_SOL_ADDRESS
} from "src/utils/addresses";
import BrendanTwitterPFP from "src/assets/images/brendan-twitter-pfp.png";
import CyrfinLogo from "src/assets/images/cyrfin-logo.svg";
import Code4renaLogo from "src/assets/images/code4rena-logo.png";
import ClockIcon from "src/assets/images/clock-icon.svg";

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
    usedBy?: number;
    type: {
      type: WellComponentType;
      display: string;
      imgSrc?: string;
    };
    tokenSuffixAbbreviation?: string;
  };
  info: ComponentInfo[];
  links: {
    etherscan?: string;
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
  address: WELL_DOT_SOL_ADDRESS,
  component: {
    name: "Well.sol",
    summary: "A standard Well implementation that prioritizes flexibility and composability.",
    description: [
      "A standard Well implementation that prioritizes flexibility and composability.",
      "Fits many use cases for a Liquidity Well."
    ],
    usedBy: 1,
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
    etherscan: `https://etherscan.io/address/${WELL_DOT_SOL_ADDRESS}`,
    github: "https://github.com/BeanstalkFarms/Basin/blob/master/src/Well.sol",
    learnMore: "https://github.com/BeanstalkFarms/Basin/blob/master/src/Well.sol"
  }
};

const MultiFlowPump: WellComponentInfo = {
  address: MULTI_FLOW_PUMP_ADDRESS,
  component: {
    name: "Multi Flow",
    fullName: "MultiFlow Pump",
    summary: "An inter-block MEV manipulation resistant oracle implementation.",
    description: [
      "Comprehensive multi-block MEV manipulation-resistant Oracle implementation which serves up Well pricing data with an EMA for instantaneous prices and a TWAP for weighted averages over time."
    ],
    usedBy: 1,
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
      url: "https://twitter.com/brendaann__"
    },
    { label: "Deployed Block", value: "17977942" },
    { label: "Audited by", value: basinAuditInfo }
  ],
  links: {
    etherscan: `https://etherscan.io/address/${MULTI_FLOW_PUMP_ADDRESS}`,
    github: "https://github.com/BeanstalkFarms/Basin/blob/master/src/pumps/MultiFlowPump.sol",
    learnMore: "https://github.com/BeanstalkFarms/Basin/blob/master/src/pumps/MultiFlowPump.sol"
  }
};

const ConstantProduct2: WellComponentInfo = {
  address: CONSTANT_PRODUCT_2_ADDRESS,
  component: {
    name: "Constant Product 2",
    summary: "A standard x*y = k token pricing function for two tokens with no fees.",
    description: ["A standard x*y = k token pricing function for two tokens with no fees."],
    url: "https://github.com/BeanstalkFarms/Basin/blob/master/src/functions/ConstantProduct2.sol",
    type: {
      type: WellComponentType.WellFunction,
      display: "Well Function",
      imgSrc: ClockIcon
    },
    usedBy: 1,
    tokenSuffixAbbreviation: "CP2w"
  },
  info: [
    { label: "Deployed By", value: "Beanstalk Farms", imgSrc: BeanstalkFarmsLogo },
    { label: "Deployed Block", value: "17977906" },
    { label: "Audited by", value: basinAuditInfo }
  ],
  links: {
    etherscan: `https://etherscan.io/address/${CONSTANT_PRODUCT_2_ADDRESS}`,
    github:
      "https://github.com/BeanstalkFarms/Basin/blob/master/src/functions/ConstantProduct2.sol",
    learnMore:
      "https://github.com/BeanstalkFarms/Basin/blob/master/src/functions/ConstantProduct2.sol"
  }
};

export const useWhitelistedWellComponents = (): {
  wellImplementations: readonly WellComponentInfo[];
  pumps: readonly WellComponentInfo[];
  wellFunctions: readonly WellComponentInfo[];
} => {
  return useMemo(() => {
    const mapping = {
      wellImplementations: [{ ...WellDotSol }],
      pumps: [{ ...MultiFlowPump }],
      wellFunctions: [{ ...ConstantProduct2 }]
    } as const;

    return mapping;
  }, []);
};
