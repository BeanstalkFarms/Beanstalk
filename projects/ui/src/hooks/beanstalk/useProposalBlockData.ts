import BigNumber from 'bignumber.js';
import { useEffect, useMemo, useState } from 'react';
import { ZERO_BN } from '~/constants';
import { STALK } from '~/constants/tokens';
import { useAllVotesQuery, useProposalVotingPowerQuery } from '~/generated/graphql';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { GovSpace, getQuorumPct } from '~/lib/Beanstalk/Governance';
import { getProposalTag, getProposalType, Proposal, tokenResult } from '~/util';
import useTotalBeaNFTsMintedAtBlock from './useTotalBeaNFTsMintedAtBlock';

type VoteData = {
  voter: string; 
  choice: any; 
  vp?: number | undefined | null
};

export type ProposalBlockData = {
  /** The proposal tag (BIP-0) */
  tag: string;
  /** The proposal type (BIP) */
  type: string;
  /** The percentage of outstanding Stalk that needs to vote to reach Quorum for this `type`. */
  pctForQuorum: number | undefined;
  /** */
  score: BigNumber;
  /** The total outstanding Stalk/BeaNFTs at the proposal block. */
  totalOutstanding: BigNumber | undefined;
  /** The total number of Stalk/BeaNFTs needed to reach quorum. */
  totalForQuorum: BigNumber | undefined;
  /** The percentage of Stalk/BeanNFTs voting `for` divided by the Stalk/BeaNFTs needed for Quorum. */
  pctOfQuorum: number | undefined;
  /** The voting power (in Stalk / BeaNFTs) of `account` at the proposal block. */
  votingPower: BigNumber | undefined;
  /** All votes cast in this proposal. */
  votes: VoteData[] | undefined;
};

function useTotalOutstandingAtBlock(proposal: Proposal) {
  /// Beanstalk
  const beanstalk = useBeanstalkContract();

  /// Local State
  const [loading, setLoading] = useState(true);
  const [totalStalk, setTotalStalk] = useState<undefined | BigNumber>(
    undefined
  );

  const isNFT = proposal.space.id === GovSpace.BeanNFT;

  const blockTag = proposal.snapshot
    ? parseInt(proposal.snapshot, 10)
    : undefined;

  /// Queries
  const [totalBeaNFTs, totalBeaNFTsLoading] = useTotalBeaNFTsMintedAtBlock(
    blockTag,
    { skip: !isNFT }
  );

  useEffect(() => {
    if (!blockTag || isNFT || totalStalk) return;
    (async () => {
      try {
        const stalkResult = tokenResult(STALK);
        const _totalStalk = await beanstalk
          .totalStalk({ blockTag })
          .then(stalkResult);
        setTotalStalk(_totalStalk);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, [beanstalk, blockTag, isNFT, totalStalk]);

  return useMemo(() => {
    if (isNFT) {
      return [totalBeaNFTs, totalBeaNFTsLoading] as const;
    }
    return [totalStalk, loading] as const;
  }, [isNFT, loading, totalBeaNFTs, totalBeaNFTsLoading, totalStalk]);
}

export default function useProposalBlockData(
  proposal: Proposal,
  account?: string
): {
  loading: boolean;
  data: ProposalBlockData;
} {
  /// Proposal info
  const tag = getProposalTag(proposal.title);
  const type = getProposalType(tag);
  const pctNeededForQuorum = getQuorumPct(type); // undefined if there is no set quorum

  const score =
    proposal.space.id === GovSpace.BeanSprout
      ? new BigNumber(proposal.scores_total || ZERO_BN)
      : proposal.title.includes("BFCP-B-") && proposal.choices && proposal.choices[1].includes("Remove")
        ? new BigNumber(proposal.scores[1])
        : new BigNumber(proposal.scores[0] || ZERO_BN);

  /// Voting power
  const { data: vpData } = useProposalVotingPowerQuery({
    variables: {
      voter_address: account?.toLowerCase() || '',
      proposal_id: proposal?.id.toLowerCase() || '',
      space: proposal?.space?.id?.toLowerCase() || '',
    },
    skip: !account || !proposal?.id || !proposal?.space?.id,
    context: { subgraph: 'snapshot' },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'cache-only',
  });

  const [totalOutstanding, isLoading] = useTotalOutstandingAtBlock(proposal);

  const votingPower = useMemo(
    () => (vpData?.vp?.vp ? new BigNumber(vpData.vp.vp) : undefined),
    [vpData?.vp?.vp]
  );

  const totalForQuorum =
    pctNeededForQuorum && totalOutstanding
      ? totalOutstanding.times(pctNeededForQuorum)
      : undefined;

  const pctOfQuorum =
    score && totalForQuorum ? score.div(totalForQuorum).toNumber() : undefined;

  /// Votes
  const { data: voteData } = useAllVotesQuery({
    variables: {
      proposal_id: proposal?.id.toLowerCase()
    },
    skip: !proposal?.id,
    context: { subgraph: 'snapshot' },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'network-only',
  });

  return {
    loading: isLoading,
    data: {
      // Metadata
      tag,
      type,
      pctForQuorum: pctNeededForQuorum,
      // Proposal
      score,
      totalOutstanding,
      totalForQuorum,
      pctOfQuorum,
      // Account
      votingPower,
      // Votes
      votes: voteData?.votes as VoteData[] || undefined
    },
  };
}
