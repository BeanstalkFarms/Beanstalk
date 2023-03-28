import BigNumber from 'bignumber.js';

export enum GovSpace {
  BeanstalkDAO    = 'beanstalkdao.eth',
  BeanstalkFarms  = 'beanstalkfarms.eth',
  BeanSprout      = 'wearebeansprout.eth',
}

export enum GovProposalType {
  BIP = 'BIP',
  BOP = 'BOP',
  BFCP_A = 'BFCP-A',
  BFCP_B = 'BFCP-B',
  BFCP_C = 'BFCP-C',
  BFCP_D = 'BFCP-D',
  BSP = 'BSP',
}

export const SNAPSHOT_SPACES = Object.values(GovSpace);

const QUORUM = {
  [GovProposalType.BIP]:     0.5,
  [GovProposalType.BOP]:     0.35,
  [GovProposalType.BFCP_A]:  0.25,
  [GovProposalType.BFCP_B]:  0.25,
  [GovProposalType.BFCP_C]:  0.25,
  [GovProposalType.BFCP_D]:  0.25,
  [GovProposalType.BSP]:     0.1,
};

export const getQuorumPct = (type: string) => {
  if (type in QUORUM) {
    return QUORUM[type as keyof typeof QUORUM];
  }
  return undefined;
};

export const getQuorum = (type: string, totalStalk: BigNumber) => {
  if (type in QUORUM) {
    return totalStalk.multipliedBy(QUORUM[type as keyof typeof QUORUM]);
  }
  return undefined;
};
