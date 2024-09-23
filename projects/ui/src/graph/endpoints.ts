export enum SGEnvironments {
  BF_PROD = 'bf-prod',
  BF_DEV = 'bf-dev',
  BF_TEST = 'bf-test',
}

type SGEnvironment = {
  name: string;
  subgraphs: {
    beanstalk: string;
    bean: string;
    beanstalk_eth: string;
    bean_eth: string;
    beanft: string;
  };
};

const BASE_SUBGRAPH_URL = 'https://graph.bean.money';

const BEANFT_SUBGRAPH_URL =
  'https://graph.node.bean.money/subgraphs/name/beanft';

export const SUBGRAPH_ENVIRONMENTS: Record<SGEnvironments, SGEnvironment> = {
  [SGEnvironments.BF_PROD]: {
    name: 'Beanstalk Farms / Production',
    subgraphs: {
      beanstalk: `${BASE_SUBGRAPH_URL}/beanstalk`,
      bean: `${BASE_SUBGRAPH_URL}/bean`,
      beanstalk_eth: `${BASE_SUBGRAPH_URL}/beanstalk_eth`,
      bean_eth: `${BASE_SUBGRAPH_URL}/bean_eth`,
      beanft: BEANFT_SUBGRAPH_URL,
    },
  },
  [SGEnvironments.BF_DEV]: {
    name: 'Beanstalk Farms / Development',
    subgraphs: {
      beanstalk: `${BASE_SUBGRAPH_URL}/beanstalk-dev`,
      bean: `${BASE_SUBGRAPH_URL}/bean-dev`,
      beanstalk_eth: `${BASE_SUBGRAPH_URL}/beanstalk-dev_eth`,
      bean_eth: `${BASE_SUBGRAPH_URL}/bean-dev_eth`,
      beanft: BEANFT_SUBGRAPH_URL,
    },
  },
  [SGEnvironments.BF_TEST]: {
    name: 'Beanstalk Farms / Test',
    subgraphs: {
      beanstalk: `${BASE_SUBGRAPH_URL}/beanstalk-testing`,
      bean: `${BASE_SUBGRAPH_URL}/bean-testing`,
      beanstalk_eth: `${BASE_SUBGRAPH_URL}/beanstalk-testing_eth`,
      bean_eth: `${BASE_SUBGRAPH_URL}/bean-testing_eth`,
      beanft: BEANFT_SUBGRAPH_URL,
    },
  },
};
