import React from 'react';
import {
  Box,
  Card, CircularProgress,
  Container, Grid,
  Stack, Typography
} from '@mui/material';
import { useParams } from 'react-router-dom';
import BigNumber from 'bignumber.js';
import GovernanceActions from '~/components/Governance/Actions';
import ProposalContent from '~/components/Governance/Proposal';
import { useProposalQuery } from '~/generated/graphql';
import { Proposal } from '~/util/Governance';
import PageNotFound from '~/pages/error/404';

import { FC } from '~/types';
import useProposalBlockData from '~/hooks/beanstalk/useProposalBlockData';
import useAccount from '~/hooks/ledger/useAccount';
import { ZERO_BN } from '~/constants';
import PagePath from '~/components/Common/PagePath';

const getCrumbTitle = (title: string) => {
  const split = title.split(':');
  return split.length ? split[0].trim().toString() : title;
};

const ProposalPageInner : FC<{ proposal: Proposal }> = ({ proposal }) => {
  ///
  const account = useAccount();

  /// Query: Quorum
  const quorum = useProposalBlockData(proposal, account);
  const score = (
    proposal.space.id === 'wearebeansprout.eth'
      ? new BigNumber(proposal.scores_total || ZERO_BN)
      : new BigNumber(proposal.scores[0] || ZERO_BN)
  );

  return (
    <Container maxWidth="lg">
      <Stack gap={2}>
        <PagePath
          items={[
          { path: '/governance', title: 'Governance' },
          { path: `/governance/${proposal.id}`, title: getCrumbTitle(proposal.title) },
        ]} 
        />
        {/* <PageHeader returnPath="/governance" /> */}
        <Grid container direction={{ xs: 'column-reverse', md: 'row' }} spacing={{ xs: 0, md: 2 }} gap={{ xs: 2, md: 0 }} maxWidth="100%">
          <Grid item xs={12} md={8} maxWidth="100% !important">
            <ProposalContent
              proposal={proposal}
              quorum={quorum}
            />
          </Grid>
          <Grid item xs={12} md={4} maxWidth="100%">
            <GovernanceActions
              proposal={proposal}
              quorum={quorum}
            />
          </Grid>
        </Grid>
      </Stack>
    </Container>
  );
};

const ProposalPage: FC<{}> = () => {
  /// Routing
  const { id } = useParams<{ id: string }>();

  /// Query: Proposal
  const { loading, error, data } = useProposalQuery({
    variables: { proposal_id: id || '' },
    context: { subgraph: 'snapshot' },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'network-only',
    skip: !id
  });
  const proposal = data?.proposal as Proposal;

  /// Loading or Error
  if (loading || error) {
    return (
      <>
        {error ? (
          <Card>
            <Box height={300} display="flex" alignItems="center" justifyContent="center">
              <Typography>Error: {error.message}</Typography>
            </Box>
          </Card>
        ) : (
          <Box height={300} display="flex" alignItems="center" justifyContent="center">
            <CircularProgress />
          </Box>
        )}
      </>
    );
  }

  /// Finished loading but no proposal
  if ((!loading && data?.proposal === null) || !id) {
    return <PageNotFound />;
  }

  return (
    <ProposalPageInner proposal={proposal} />
  );
};

export default ProposalPage;
