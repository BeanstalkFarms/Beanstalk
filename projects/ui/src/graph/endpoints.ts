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
      bean: `https://graph.node.bean.money/subgraphs/name/bean`,
      // https://gateway-arbitrum.network.thegraph.com/api/${
      //  import.meta.env.VITE_THEGRAPH_API_KEY
      // }/subgraphs/id/Hqtmas8CJUHXwFf7acS2sjaTw6tvdNQM3kaz2CqtYM3V`,
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
      beanstalk:
        'https://api.studio.thegraph.com/query/69878/beanstalkdev/v2.2.1.1',
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


// export enum SGEnvironments {
//   BF_PROD = 'bf-prod',
//   BF_DEV = 'bf-dev',
//   BF_TEST = 'bf-test',
// }

// type SGEnvironment = {
//   name: string;
//   subgraphs: {
//     beanstalk: string;
//     bean: string;
//     // beanft: string;
//     beanstalk_eth: string;
//     bean_eth: string;
//   };
// };

// const ENDPOINT = 'https://graph.bean.money';

// export const SUBGRAPH_ENVIRONMENTS: Record<SGEnvironments, SGEnvironment> = {
//   [SGEnvironments.BF_PROD]: {
//     name: 'Beanstalk Farms / Production',
//     subgraphs: {
//       beanstalk: `${ENDPOINT}/beanstalk`,
//       bean: `${ENDPOINT}/bean`,
//       beanstalk_eth: `${ENDPOINT}/beanstalk_eth`,
//       bean_eth: `${ENDPOINT}/bean_eth`,
//     },
//   },
//   [SGEnvironments.BF_DEV]: {
//     name: 'Beanstalk Farms / Development',
//     subgraphs: {
//       beanstalk: `${ENDPOINT}/beanstalk-dev`,
//       bean: `${ENDPOINT}/bean-dev`,
//       beanstalk_eth: `${ENDPOINT}/beanstalk-dev_eth`,
//       bean_eth: `${ENDPOINT}/bean-dev_eth`,
//     },
//   },
//   [SGEnvironments.BF_TEST]: {
//     name: 'Beanstalk Farms / Test',
//     subgraphs: {
//       beanstalk: `${ENDPOINT}/beanstalk-testing`,
//       bean: `${ENDPOINT}/bean-testing`,
//       beanstalk_eth: `${ENDPOINT}/beanstalk-testing_eth`,
//       bean_eth: `${ENDPOINT}/bean-testing_eth`,
//     },
//   },
// };

// // keeping as reference
// // beanft: 'https://graph.node.bean.money/subgraphs/name/beanft',