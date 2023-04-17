import BigNumber from 'bignumber.js';
import { useEffect, useState } from 'react';
import { ZERO_BN } from '~/constants';
import { STALK } from '~/constants/tokens';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { getQuorumPct } from '~/lib/Beanstalk/Governance';
import { getProposalTag, getProposalType, Proposal, tokenResult } from '~/util';

export type ProposalBlockData = {
  /** The proposal tag (BIP-0) */
  tag: string;
  /** The proposal type (BIP) */
  type: string;
  /** The percentage of outstanding Stalk that needs to vote to reach Quorum for this `type`. */
  pctStalkForQuorum: number | undefined;
  /** */
  score: BigNumber;
  /** The total outstanding Stalk at the proposal block. */
  totalStalk: BigNumber | undefined;
  /** The total number of Stalk needed to reach quorum. */
  stalkForQuorum: BigNumber | undefined;
  /** The percentage of Stalk voting `for` divided by the Stalk needed for Quorum. */
  pctOfQuorum: number | undefined;
  /** The voting power (in Stalk) of `account` at the proposal block. */
  votingPower: BigNumber | undefined;
}

export default function useProposalBlockData(
  proposal: Proposal,
  account?: string,
) : {
  loading: boolean,
  data: ProposalBlockData
} {
  /// Proposal info
  const tag = getProposalTag(proposal.title);
  const type = getProposalType(tag);
  const pctStalkForQuorum = getQuorumPct(type); // undefined if there is no set quorum

  /// Beanstalk
  const beanstalk = useBeanstalkContract();
  const [totalStalk, setTotalStalk] = useState<undefined | BigNumber>(undefined);
  const [votingPower, setVotingPower] = useState<undefined | BigNumber>(undefined);
  const [loading, setLoading] = useState(true);
  
  const score = (
    proposal.space.id === 'wearebeansprout.eth'
      ? new BigNumber(proposal.scores_total || ZERO_BN)
      : new BigNumber(proposal.scores[0] || ZERO_BN)
  );
  
  useEffect(() => {
    (async () => {
      try {
        if (!proposal.snapshot) return;
        const blockTag = parseInt(proposal.snapshot, 10);
        const stalkResult = tokenResult(STALK);
        const [_totalStalk, _votingPower] = await Promise.all([
          beanstalk.totalStalk({ blockTag }).then(stalkResult),
          account ? beanstalk.balanceOfStalk(account, { blockTag }).then(stalkResult) : Promise.resolve(undefined),
        ]);
        setTotalStalk(_totalStalk);
        setVotingPower(_votingPower);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [beanstalk, tag, proposal.snapshot, account]);
  
  //
  const stalkForQuorum = (pctStalkForQuorum && totalStalk)
    ? totalStalk.times(pctStalkForQuorum)
    : undefined;
  const pctOfQuorum = (score && stalkForQuorum)
    ? score.div(stalkForQuorum).toNumber()
    : undefined;

  return {
    loading,
    data: {
      // Metadata
      tag,
      type,
      pctStalkForQuorum,
      // Proposal
      score,
      totalStalk,
      stalkForQuorum,
      pctOfQuorum,
      // Account
      votingPower,
    }
  };
}
