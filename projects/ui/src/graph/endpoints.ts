export enum SGEnvironments {
  BF_PROD = 'bf-prod',
  BF_DEV = 'bf-dev',
  BF_TEST = 'bf-test',
  BF_2_0_3 = 'bf-2.0.3',
  DNET_2_0_3 = 'dnet-2.0.3',
}

type SGEnvironment = {
  name: string;
  subgraphs: {
    beanstalk: string;
    bean: string;
  }
}

export const SUBGRAPH_ENVIRONMENTS : Record<SGEnvironments, SGEnvironment> = {
  [SGEnvironments.BF_PROD]:       {
    name: 'Beanstalk Farms / Production',
    subgraphs: {
      beanstalk: 'https://graph.node.bean.money/subgraphs/name/beanstalk',
      bean: 'https://graph.node.bean.money/subgraphs/name/bean'
    },
  },
  [SGEnvironments.BF_DEV]:        {
    name: 'Beanstalk Farms / Development',
    subgraphs: {
      beanstalk: 'https://graph.node.bean.money/subgraphs/name/beanstalk-dev',
      bean: 'https://graph.node.bean.money/subgraphs/name/bean-dev'
    }
  },
  [SGEnvironments.BF_TEST]:       {
    name: 'Beanstalk Farms / Test',
    subgraphs: {
      beanstalk: 'https://graph.node.bean.money/subgraphs/name/beanstalk-testing',
      bean: 'https://graph.node.bean.money/subgraphs/name/bean-testing'
    }
  },
  [SGEnvironments.BF_2_0_3]: {
    name: 'Beanstalk Farms / v2.0.3',
    subgraphs: {
      beanstalk: 'https://graph.node.bean.money/subgraphs/name/beanstalk-2-0-3',
      bean: 'https://graph.node.bean.money/subgraphs/name/bean', // fixme
    }
  },
  [SGEnvironments.DNET_2_0_3]: {
    name: 'Decentralized Network / v2.0.3',
    subgraphs: {
      beanstalk: `https://gateway.thegraph.com/api/${import.meta.env.VITE_THEGRAPH_API_KEY}/subgraphs/id/R9rnzRuiyDybfDsZfoM7eA9w8WuHtZKbroGrgWwDw1d`,
      bean: 'https://graph.node.bean.money/subgraphs/name/bean', // fixme
    }
  },
};
