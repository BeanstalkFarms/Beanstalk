export enum SGEnvironments {
  BF_PROD = 'bf-prod',
  BF_DEV = 'bf-dev',
  BF_TEST = 'bf-test',
  BF_2_0_3 = 'bf-2.0.3',
  DNET = 'dnet',
}

type SGEnvironment = {
  name: string;
  subgraphs: {
    beanstalk: string;
    bean: string;
    beanft: string;
  };
};

export const SUBGRAPH_ENVIRONMENTS: Record<SGEnvironments, SGEnvironment> = {
  [SGEnvironments.BF_PROD]: {
    name: 'Beanstalk Farms / Production',
    subgraphs: {
      beanstalk: 'https://graph.node.bean.money/subgraphs/name/beanstalk',
      bean: `https://gateway-arbitrum.network.thegraph.com/api/${
        import.meta.env.VITE_THEGRAPH_API_KEY
      }/subgraphs/id/Hqtmas8CJUHXwFf7acS2sjaTw6tvdNQM3kaz2CqtYM3V`,
      beanft: 'https://graph.node.bean.money/subgraphs/name/beanft',
    },
  },
  [SGEnvironments.BF_DEV]: {
    name: 'Beanstalk Farms / Development',
    subgraphs: {
      beanstalk: 'https://graph.node.bean.money/subgraphs/name/beanstalk-dev',
      bean: 'https://graph.node.bean.money/subgraphs/name/bean-dev',
      beanft: 'https://graph.node.bean.money/subgraphs/name/beanft-dev',
    },
  },
  [SGEnvironments.BF_TEST]: {
    name: 'Beanstalk Farms / Test',
    subgraphs: {
      beanstalk:
        'https://graph.node.bean.money/subgraphs/name/beanstalk-testing',
      bean: 'https://graph.node.bean.money/subgraphs/name/bean-testing',
      beanft: 'https://graph.node.bean.money/subgraphs/name/beanft-dev',
    },
  },
  [SGEnvironments.BF_2_0_3]: {
    name: 'Beanstalk Farms / v2.0.3',
    subgraphs: {
      beanstalk: 'https://graph.node.bean.money/subgraphs/name/beanstalk-2-0-3',
      bean: 'https://graph.node.bean.money/subgraphs/name/bean', // fixme
      beanft: 'https://graph.node.bean.money/subgraphs/name/beanft-dev',
    },
  },
  [SGEnvironments.DNET]: {
    name: 'Decentralized Network / v2.2.1',
    subgraphs: {
      beanstalk: `https://gateway-arbitrum.network.thegraph.com/api/${
        import.meta.env.VITE_THEGRAPH_API_KEY
      }/subgraphs/id/CQgB9aDyd13X6rUtJcCWr8KtFpGGRMifu1mM6k4xQ9YA`,
      bean: `https://gateway-arbitrum.network.thegraph.com/api/${
        import.meta.env.VITE_THEGRAPH_API_KEY
      }/subgraphs/id/Hqtmas8CJUHXwFf7acS2sjaTw6tvdNQM3kaz2CqtYM3V`,
      beanft: 'https://graph.node.bean.money/subgraphs/name/beanft-dev',
    },
  },
};
