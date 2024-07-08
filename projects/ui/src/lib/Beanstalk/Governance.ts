import BigNumber from 'bignumber.js';
import { ONE_BN } from '~/constants';

export enum GovSpace {
  BeanstalkDAO = 'beanstalkdao.eth',
  BeanstalkFarms = 'beanstalkfarms.eth',
  BeanSprout = 'wearebeansprout.eth',
  BeanNFT = 'beanft.eth',
  BeanstalkFarmsBudget = 'beanstalkfarmsbudget.eth',
  BeanstalkBugBounty = 'beanstalkbugbounty.eth',
  BeanstalkCommunityMultisig = '',
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

/**
 * Quorum for BIPs and BOPs changed via BIP-47 in the following manner:
 * BIPs: 50% vote for -> Min(50%, (1/3 * 100)% + % votes against)
 * BOPs: 35% vote for => Min(50%, 25% + % votes against)
 */
const QUORUM = {
  [GovProposalType.BIP]: 0.5,
  [GovProposalType.BOP]: 0.5,
  [GovProposalType.BFCP_A]: 0.25,
  [GovProposalType.BFCP_B]: 0.35,
  [GovProposalType.BFCP_C]: 0.25,
  [GovProposalType.BFCP_D]: 0.25,
  // [GovProposalType.BSP]: 0.1,
  [GovProposalType.BNP]: 0.15,
  [GovProposalType.FILL]: -1,
};

export const BIP_BASE_MIN_QUORUM = ONE_BN.div(3);
export const BOP_BASE_MIN_QUORUM = ONE_BN.div(4);

export const BIP_47_END_TIME = 1717034400;

/// Reverse Map of GovProposalType
const GovProposalTypeMap = {
  BIP: GovProposalType.BIP,
  BOP: GovProposalType.BOP,
  'BFCP-A': GovProposalType.BFCP_A,
  'BFCP-B': GovProposalType.BFCP_B,
  'BFCP-C': GovProposalType.BFCP_C,
  'BFCP-D': GovProposalType.BFCP_D,
  // BSP: GovProposalType.BSP,
  BNP: GovProposalType.BNP,
  CHECK: GovProposalType.FILL,
};

export const getGovTypeByTag = (tag: string) => {
  if (tag in GovProposalTypeMap) {
    return GovProposalTypeMap[tag as keyof typeof GovProposalTypeMap];
  }
  return GovProposalType.FILL;
};

const getHasQuorum = (type: string) => type !== GovProposalType.FILL;

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
