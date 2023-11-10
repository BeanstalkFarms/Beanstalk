import BigNumber from 'bignumber.js';

export enum GovSpace {
  BeanstalkDAO = 'beanstalkdao.eth',
  BeanstalkFarms = 'beanstalkfarms.eth',
  BeanSprout = 'wearebeansprout.eth',
  BeanNFT = 'beanft.eth',
}

export enum GovProposalType {
  BIP = 'BIP',
  BOP = 'BOP',
  BFCP_A = 'BFCP-A',
  BFCP_B = 'BFCP-B',
  BFCP_C = 'BFCP-C',
  BFCP_D = 'BFCP-D',
  BSP = 'BSP',
  BNP = 'BNP',
  FILL = 'FILL',
  // TEST
  BFCP_C_X = 'BFCP-C-X',
}

export const SNAPSHOT_SPACES = Object.values(GovSpace);

const QUORUM = {
  [GovProposalType.BIP]: 0.5,
  [GovProposalType.BOP]: 0.35,
  [GovProposalType.BFCP_A]: 0.25,
  [GovProposalType.BFCP_B]: 0.35,
  [GovProposalType.BFCP_C]: 0.25,
  [GovProposalType.BFCP_D]: 0.25,
  [GovProposalType.BSP]: 0.1,
  [GovProposalType.BNP]: 0.15,
  [GovProposalType.FILL]: -1,
};

/// Reverse Map of GovProposalType
const GovProposalTypeMap = {
  BIP: GovProposalType.BIP,
  BOP: GovProposalType.BOP,
  'BFCP-A': GovProposalType.BFCP_A,
  'BFCP-B': GovProposalType.BFCP_B,
  'BFCP-C': GovProposalType.BFCP_C,
  'BFCP-D': GovProposalType.BFCP_D,
  BSP: GovProposalType.BSP,
  BNP: GovProposalType.BNP,
  CHECK: GovProposalType.FILL,
};

export const getGovTypeByTag = (tag: string) => {
  if (tag in GovProposalTypeMap) {
    return GovProposalTypeMap[tag as keyof typeof GovProposalTypeMap];
  }
  return GovProposalType.FILL;
};

export const getHasQuorum = (type: string) => type !== GovProposalType.FILL;

export const getQuorumPct = (type: string) => {
  if (type in QUORUM && getHasQuorum(type)) {
    return QUORUM[type as keyof typeof QUORUM];
  }
  return undefined;
};

export const getQuorum = (type: string, totalStalk: BigNumber) => {
  if (type in QUORUM && getHasQuorum(type)) {
    return totalStalk.multipliedBy(QUORUM[type as keyof typeof QUORUM]);
  }
  return undefined;
};
