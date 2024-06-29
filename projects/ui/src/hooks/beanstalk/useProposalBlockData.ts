import BigNumber from 'bignumber.js';
import { useEffect, useMemo, useState } from 'react';
import { ZERO_BN } from '~/constants';
import { STALK } from '~/constants/tokens';
import {
  useAllVotesQuery,
  useProposalVotingPowerQuery,
} from '~/generated/graphql';
import {
  useBeanstalkContract,
  useEnsReverseRecords,
} from '~/hooks/ledger/useContract';
import {
  BIP_47_END_TIME,
  BIP_BASE_MIN_QUORUM,
  BOP_BASE_MIN_QUORUM,
  GovProposalType,
  GovSpace,
  getQuorumPct,
} from '~/lib/Beanstalk/Governance';
import { getProposalTag, getProposalType, Proposal, tokenResult } from '~/util';
import useTotalBeaNFTsMintedAtBlock from './useTotalBeaNFTsMintedAtBlock';

type VoteData = {
  voter: string;
  choice: any;
  vp?: number | undefined | null;
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

function useMinQuorumRatio(
  proposal: Proposal,
  totalOutstanding: BigNumber | undefined
) {
  const tag = getProposalTag(proposal.title);
  const type = getProposalType(tag);
  const baseQuorumRatio = getQuorumPct(type); // undefined if there is no set quorum

  const isBOP = type === GovProposalType.BOP;
  const isBIP = type === GovProposalType.BIP;

  const isAfterBIP47 = proposal.start > BIP_47_END_TIME;

  if (!(isBOP || isBIP) || !isAfterBIP47 || !baseQuorumRatio) {
    return baseQuorumRatio;
  }

  const { choices = [], scores = [] } = proposal;

  const againstIndex = choices.indexOf('Against') ?? -1;

  const againstAmount =
    againstIndex >= 0 && scores.length - 1 >= againstIndex
      ? scores[againstIndex]
      : undefined;

  if (againstAmount === undefined || !totalOutstanding) return undefined;

  const baseMinQuorum = isBIP ? BIP_BASE_MIN_QUORUM : BOP_BASE_MIN_QUORUM;

  const againstRatio = new BigNumber(againstAmount).div(totalOutstanding);

  const minQuorum = BigNumber.min(
    baseMinQuorum.plus(againstRatio),
    baseQuorumRatio
  );

  return minQuorum.toNumber();
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

  const score =
    proposal.space.id === GovSpace.BeanSprout
      ? new BigNumber(proposal.scores_total || ZERO_BN)
      : proposal.title.includes('BFCP-B-') &&
          proposal.choices &&
          proposal.choices[1].includes('Remove')
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
  const ratioNeededForQuorum = useMinQuorumRatio(proposal, totalOutstanding);

  const votingPower = useMemo(
    () => (vpData?.vp?.vp ? new BigNumber(vpData.vp.vp) : undefined),
    [vpData?.vp?.vp]
  );

  const totalForQuorum =
    ratioNeededForQuorum && totalOutstanding
      ? totalOutstanding.times(ratioNeededForQuorum)
      : undefined;

  const pctOfQuorum =
    score && totalForQuorum ? score.div(totalForQuorum).toNumber() : undefined;

  /// Votes
  const { data: voteData } = useAllVotesQuery({
    variables: {
      proposal_id: proposal?.id.toLowerCase(),
    },
    skip: !proposal?.id,
    context: { subgraph: 'snapshot' },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'network-only',
  });

  const votes = voteData?.votes as VoteData[];

  const ens = useEnsReverseRecords();
  const [votesWithEns, setVotesWithEns] = useState<
    Array<VoteData & { ens: string }>
  >([]);
  const [loadingEns, setLoadingEns] = useState(true);

  useMemo(() => {
    (async () => {
      if (!votes) return;
      const voterAddresses = votes.map((vote) => vote.voter);
      const names = voterAddresses
        ? await ens.getNames(voterAddresses)
        : undefined;
      let votesEns;
      if (names) {
        votesEns = votes.map((vote, index) => ({
          ...vote,
          ens: names[index],
        }));
      } else {
        votesEns = votes.map((vote) => ({
          ...vote,
          ens: '',
        }));
      }
      setVotesWithEns(votesEns);
      setLoadingEns(false);
    })();
  }, [ens, votes]);

  return {
    loading: isLoading || loadingEns,
    data: {
      // Metadata
      tag,
      type,
      pctForQuorum: ratioNeededForQuorum,
      // Proposal
      score,
      totalOutstanding,
      totalForQuorum,
      pctOfQuorum,
      // Account
      votingPower,
      // Votes
      votes: votesWithEns || undefined,
    },
  };
}
