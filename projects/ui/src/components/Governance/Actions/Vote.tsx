import { Button, CircularProgress, Divider, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import { Form, Formik, FormikHelpers, FormikProps } from 'formik';
import React, { useCallback, useMemo } from 'react';
import LoadingButton from '@mui/lab/LoadingButton';
import snapshot from '@snapshot-labs/snapshot.js';
import { Wallet } from 'ethers';
import BigNumber from 'bignumber.js';
import { useSelector } from 'react-redux';
import { useVotesQuery } from '~/generated/graphql';
import DescriptionButton from '~/components/Common/DescriptionButton';
import { useSigner } from '~/hooks/ledger/useSigner';
import { arraysEqual, displayBN, displayFullBN } from '~/util';
import TransactionToast from '~/components/Common/TxnToast';
import { Proposal } from '~/util/Governance';
import { AppState } from '~/state';
import useAccount from '~/hooks/ledger/useAccount';
import WalletButton from '~/components/Common/Connection/WalletButton';
import { SNAPSHOT_LINK, ZERO_BN } from '~/constants';
import Row from '~/components/Common/Row';
import { FC } from '~/types';
import useProposalBlockData from '~/hooks/beanstalk/useProposalBlockData';
import StatHorizontal from '~/components/Common/StatHorizontal';

type VoteFormValues = {
  /** For 'single-choice' proposals */
  choice: number | undefined;
  /** For 'approval' proposals */
  choices: number[] | undefined;
};

const VoteForm: FC<FormikProps<VoteFormValues> & {
  proposal: Proposal;
  quorum: ReturnType<typeof useProposalBlockData>;
  existingChoice: number | number[] | undefined;
}> = ({
        values,
        setFieldValue,
        isSubmitting,
        proposal,
        quorum,
        existingChoice
      }) => {
  /// State
  const account = useAccount();
  const farmerSilo = useSelector<AppState, AppState['_farmer']['silo']>((state) => state._farmer.silo);

  ///  Quorum
  const {
    data: { totalStalk, stalkForQuorum, pctStalkForQuorum: quorumPct, votingPower, tag },
    loading: loadingQuorum
  } = quorum;

  /// Time
  const today = new Date();
  const endDate = new Date(proposal.end * 1000);
  const differenceInTime = endDate.getTime() - today.getTime();

  /// Handlers
  const handleClick = useCallback((choice: number | undefined) => () => {
    if (proposal.type === 'single-choice') {
      setFieldValue('choice', choice);
    }
    if (choice && proposal.type === 'approval') {
      if (values.choices?.includes(choice)) {
        setFieldValue('choices', values.choices.filter((c) => c !== choice));
      } else {
        setFieldValue('choices', [...(values.choices ?? []), choice]);
      }
    }
  }, [proposal.type, setFieldValue, values.choices]);

  const canVote = farmerSilo.stalk.active.gt(0);
  const isClosed = differenceInTime <= 0;

  const createVoteButtons = () => {
    switch (proposal.type) {
      case 'single-choice': {
        /// Option isn't selected or the voting period has ended
        const alreadyVotedThisChoice = (
          existingChoice !== undefined
          && existingChoice === values.choice
        );
        const isInvalid = (
          values.choice === undefined // no choice selected
          || alreadyVotedThisChoice // already voted for this same choice
          || isClosed // expired
          || !canVote // no stalk
        );
        return (
          account && proposal.choices ? (
            <>
              {canVote && (
                <Stack gap={1}>
                  {proposal.choices.map((label: string, index: number) => {
                    const choice = index + 1;
                    const isSelected = values.choice === choice;
                    return (
                      <DescriptionButton
                        key={choice}
                        title={`${isSelected ? '✓ ' : ''}${label}`}
                        disabled={!canVote || isSubmitting}
                        onClick={handleClick(isSelected ? undefined : choice)}
                        isSelected={isSelected}
                        sx={{ p: 1 }}
                        StackProps={{ sx: { justifyContent: 'center' } }}
                        TitleProps={{ variant: 'body1' }}
                        size="medium"
                      />
                    );
                  })}
                </Stack>
              )}
              <LoadingButton
                type="submit"
                variant="contained"
                color="primary"
                size="medium"
                loading={isSubmitting}
                disabled={isInvalid || isSubmitting}
              >
                {canVote
                  ? (
                    alreadyVotedThisChoice
                      ? `Already Voted: ${proposal.choices[(existingChoice as number) - 1]}`
                      : 'Vote'
                  )
                  : 'Need Stalk to Vote'
                }
              </LoadingButton>
            </>
          ) : (
            <WalletButton />
          )
        );
      }
      case 'approval': {
        const isInvalid = (
          values.choices?.length === 0 // no choice selected
          || isClosed // expired
          || !canVote // no stalk
        );
        const alreadyVotedThisChoice = (
          existingChoice !== undefined
          && arraysEqual(existingChoice as number[], values.choices as number[])
        );
        return (
          account && proposal.choices ? (
            <>
              {canVote && (
                <Stack gap={1}>
                  {proposal.choices.map((label: string, index: number) => {
                    const choice = index + 1;
                    const isSelected = values.choices?.includes(choice);
                    return (
                      <DescriptionButton
                        key={choice}
                        title={`${isSelected ? '✓ ' : ''}${label}`}
                        disabled={!canVote || isSubmitting}
                        onClick={handleClick(choice)}
                        isSelected={isSelected}
                        sx={{ p: 1 }}
                        StackProps={{ sx: { justifyContent: 'center' } }}
                        TitleProps={{ variant: 'body1' }}
                        size="medium"
                      />
                    );
                  })}
                </Stack>
              )}
              <LoadingButton
                type="submit"
                variant="contained"
                color="primary"
                size="medium"
                loading={isSubmitting}
                disabled={isInvalid || isSubmitting}
              >
                {canVote
                  ? (
                    alreadyVotedThisChoice
                      ? 'Already Voted'
                      : 'Vote'
                  )
                  : 'Need Stalk to Vote'
                }
              </LoadingButton>
            </>
          ) : (
            <WalletButton />
          )
        );
      }
      default: {
        return (
          <Button
            variant="contained"
            color="primary"
            size="medium"
            href={proposal.link || SNAPSHOT_LINK}
            target="_blank"
            rel="noreferrer"
          >
            Vote on Snapshot.org &rarr;
          </Button>
        );
      }
    }
  };

  if (!proposal.choices) return null;

  // {quorumPctComplete?.gt(0) && (
  //   <>
  //     &nbsp;
  //     <CircularProgress variant="determinate" value={(quorumPctComplete.times(100)).toNumber()} size={12} thickness={8}  />
  //   </>
  // )}
  return (
    <Form autoComplete="off">
      <Stack gap={1}>
        {/**
         * Progress by choice
         */}
        <Stack px={1} pb={1} gap={1.5}>
          {(votingPower && totalStalk) && (
            <StatHorizontal
              label="Voting Power"
              labelTooltip={
                <div>
                  <Typography>A snapshot of your active STALK when voting on {tag} began.</Typography>
                </div>
              }
            >
              {displayBN(votingPower)} STALK&nbsp;·&nbsp;{displayBN(votingPower.div(totalStalk).multipliedBy(100))}%
            </StatHorizontal>
          )}
          {(quorumPct && stalkForQuorum) && (
            <StatHorizontal
              label={(
                <>
                  <Row display="inline-flex" alignItems="center">
                    <span>Quorum</span>
                  </Row>
                </>
              )}
              labelTooltip={
                <Stack gap={0.5}>
                  {stalkForQuorum && (
                    <StatHorizontal label="Stalk for Quorum">
                      ~{displayFullBN(stalkForQuorum, 2, 2)}
                    </StatHorizontal>
                  )}
                  <StatHorizontal label="Eligible Stalk">
                    ~{displayFullBN(totalStalk || ZERO_BN, 2, 2)}
                  </StatHorizontal>
                  <StatHorizontal label="Snapshot Block">
                    {proposal.snapshot}
                  </StatHorizontal>
                </Stack>
              }
            >
              {loadingQuorum ? (
                <CircularProgress size={16} />
              ) : (
                <>
                  ~{displayFullBN(stalkForQuorum, 0)} STALK&nbsp;·&nbsp;{(quorumPct * 100).toFixed(0)}%
                </>
              )}
            </StatHorizontal>
          )}
          <Divider />
          {proposal.choices.map((choice: string, index: number) => (
            <Stack gap={0.5} key={choice}>
              <Row columnGap={0.5} flexWrap="wrap" justifyContent="space-between">
                <Typography variant="body1">
                  {isClosed && existingChoice !== undefined && (existingChoice === index + 1) ? (
                    <Tooltip title={`You voted: ${proposal.choices![existingChoice - 1]}`}>
                      <span>✓&nbsp;</span>
                    </Tooltip>
                  ) : null}
                  {choice}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {displayFullBN(new BigNumber(proposal.scores[index] || 0), 0, 0)} STALK
                  <Typography
                    display={proposal.scores_total > 0 ? 'inline' : 'none'}> · {((proposal.scores[index] / proposal.scores_total) * 100).toFixed(2)}%
                  </Typography>
                </Typography>
              </Row>
              <LinearProgress
                variant="determinate"
                value={(
                  proposal.scores_total > 0
                    ? (proposal.scores[index] / proposal.scores_total) * 100
                    : 0
                )}
                sx={{ height: '10px', borderRadius: 1 }}
              />
            </Stack>
          ))}
        </Stack>
        {/**
         * Voting
         */}
        {!isClosed && createVoteButtons()}
      </Stack>
    </Form>
  );
};

// ---------------------------------------------------

const Vote: FC<{
  proposal: Proposal;
  quorum: ReturnType<typeof useProposalBlockData>;
}> = ({ proposal, quorum }) => {
  const account = useAccount();
  const { data: signer } = useSigner();

  /// Query Votes
  const { data: voteData, refetch: refetchVotes } = useVotesQuery({
    variables: {
      proposal_id: proposal?.id.toLowerCase() || '',
      voter_address: account || '',
    },
    skip: !account || !proposal?.id, // only send query when wallet connected
    context: { subgraph: 'snapshot' },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'network-only',
  });
  const existingChoice = voteData?.votes?.[0]?.choice;

  /// Form setup
  const initialValues: VoteFormValues = useMemo(() => ({
    choice: existingChoice,
    choices: existingChoice
  }), [existingChoice]);

  const onSubmit = useCallback(
    async (
      values: VoteFormValues,
      formActions: FormikHelpers<VoteFormValues>
    ) => {
      let txToast;
      try {
        const _account = await signer?.getAddress();
        if (!_account) throw new Error('Missing signer.');
        if (values.choice === undefined && values.choices === undefined) throw new Error('Select a voting choice.'); // use undefined here since 'choice' can be numerical zero
        if (!proposal) throw new Error('Error loading proposal data.');
        if (proposal.type !== 'single-choice' && proposal.type !== 'approval') throw new Error('Unsupported proposal type. Please vote through snapshot.org directly.');
        if (!proposal?.space?.id) throw new Error('Unknown space.');

        txToast = new TransactionToast({
          loading: 'Voting on proposal...',
          success: 'Vote successful. It may take some time for your vote to appear on the Beanstalk UI. Check Snapshot for the latest results.',
        });

        const hub = 'https://hub.snapshot.org';
        const client = new snapshot.Client712(hub);

        const message = {
          space: proposal.space.id,
          proposal: proposal.id,
          type: proposal.type as 'single-choice' | 'approval', // 'single-choice' | 'approval' | 'quadratic' | 'ranked-choice' | 'weighted' | 'basic';
          choice: proposal.type === 'single-choice' ? values.choice : values.choices,
          app: 'snapshot'
        };

        const result = await client.vote(
          signer as Wallet,
          _account,
          message as any
        );
        console.debug('[Vote] Voting result: ', result);
        await Promise.all([
          refetchVotes()
        ]);
        txToast.success();
      } catch (err) {
        console.error(err);
        if (txToast) {
          txToast.error(err);
        } else {
          const errorToast = new TransactionToast({});
          errorToast.error(err);
        }
        formActions.setSubmitting(false);
      }
    },
    [proposal, signer, refetchVotes]
  );

  return (
    <Formik<VoteFormValues>
      enableReinitialize
      initialValues={initialValues}
      onSubmit={onSubmit}
    >
      {(formikProps: FormikProps<VoteFormValues>) => (
        <VoteForm
          proposal={proposal}
          quorum={quorum}
          existingChoice={existingChoice}
          {...formikProps}
        />
      )}
    </Formik>
  );
};

export default Vote;
