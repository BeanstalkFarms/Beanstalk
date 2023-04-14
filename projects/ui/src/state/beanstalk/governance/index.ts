import BigNumber from 'bignumber.js';
import { AddressMap } from '~/constants';

export type ActiveProposal = {
  id:     string;
  title:  string;
  start:  number;
  end:    number;
}

export type BeanstalkGovernance = {
  /** IDs of active proposals. */
  activeProposals: Array<ActiveProposal>;
  /** */
  multisigBalances: AddressMap<BigNumber>;
}
