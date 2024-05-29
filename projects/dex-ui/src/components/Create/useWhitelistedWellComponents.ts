import { useMemo } from "react";
import BeanstalkFarmsLogo from "src/assets/images/beanstalk-farms.png";
import HalbornLogo from "src/assets/images/halborn-logo.png";
import {
  MULTI_FLOW_PUMP_ADDRESS,
  CONSTANT_PRODUCT_2_ADDRESS,
  WELL_DOT_SOL_ADDRESS
} from "src/utils/addresses";
import BrendanTwitterPFP from "src/assets/images/brendan-twitter-pfp.png";
import ClockIcon from "src/assets/images/clock-icon.svg";

export enum WellComponentType {
  WellImplementation = "WellImplementation",
  Pump = "Pump",
  WellFunction = "WellFunction"
}

type ComponentInfo = {
  label: string;
  value: string;
  imgSrc?: string;
  url?: string;
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
  };
  deploy: ComponentInfo;
  info: ComponentInfo[];
  links: {
    etherscan?: string;
    github?: string;
    learnMore?: string;
  };
};

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
  deploy: {
    label: "Deployed By",
    value: "Beanstalk Farms",
    imgSrc: BeanstalkFarmsLogo
  },
  info: [
    {
      label: "Block Deployed",
      value: "12345678"
    },
    {
      label: "Audited by",
      value: "Halborn",
      imgSrc: HalbornLogo,
      url: "https://github.com/BeanstalkFarms/Beanstalk-Audits"
    }
  ],
  links: {
    etherscan: "https://etherscan.io", // TODO: FIX ME
    github: "https://github.com/BeanstalkFarms/Basin/blob/master/src/Well.sol",
    learnMore: "https://docs.basin.exchange" // TODO: FIX ME
  }
};

const MultiFlowPump: WellComponentInfo = {
  address: MULTI_FLOW_PUMP_ADDRESS,
  component: {
    name: "Multi Flow",
    fullName: "MultiFlow Pump",
    summary: "An inter-block MEV manipulation resistant oracle implementation.",
    description: [
      "An inter-block MEV manipulation-resistant oracle implementation which can serve last values, geometric EMA values and TWA geometric SMA values."
    ],
    url: "https://docs.basin.exchange/implementations/multi-flow-pump",
    type: {
      type: WellComponentType.Pump,
      display: "🔮 Pump"
    }
  },
  deploy: {
    label: "Deployed By",
    value: "Brendan Sanderson",
    imgSrc: BrendanTwitterPFP,
    url: "https://twitter.com/brendaann__"
  },
  info: [
    {
      label: "Deployed Block",
      value: "12345678"
    }
    // TODO: What block was it deployed? , TX hash?
    // TODO: was MultiFlowPump audited?
  ],
  links: {
    etherscan: "https://etherscan.io", // TODO: FIX ME
    github: "https://github.com/BeanstalkFarms/Basin/blob/master/src/pumps/MultiFlowPump.sol"
    // learnMore: // TODO: FIX ME
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
    }
  },
  deploy: {
    label: "Deployed By",
    value: "Beanstalk Farms",
    imgSrc: BeanstalkFarmsLogo
  },
  info: [
    {
      label: "Deployed Block",
      value: "12345678"
    }
    // TODO: What block was it deployed? , TX hash?
    // TODO: was ConstantProduct2 audited?
  ],
  links: {
    etherscan: "https://etherscan.io", // TODO: FIX ME
    github: "https://github.com/BeanstalkFarms/Basin/blob/master/src/functions/ConstantProduct2.sol" // TODO: FIX ME
    // learnMore: // TODO: FIX ME
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
