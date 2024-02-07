import React, { useEffect, useState } from 'react';
import {
  Box,
  Card,
  CircularProgress,
  Container,
  Grid,
  Stack,
  Typography,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import GovernanceActions from '~/components/Governance/Actions';
import ProposalContent from '~/components/Governance/Proposal';
import { useProposalQuery } from '~/generated/graphql';
import { Proposal } from '~/util/Governance';
import PageNotFound from '~/pages/error/404';

import { FC } from '~/types';
import useProposalBlockData from '~/hooks/beanstalk/useProposalBlockData';
import useAccount from '~/hooks/ledger/useAccount';
import PagePath from '~/components/Common/PagePath';

const getCrumbTitle = (title: string) => {
  const split = title.split(':');
  return split.length ? split[0].trim().toString() : title;
};

const ProposalPageInner: FC<{ proposal: Proposal }> = ({ proposal }) => {
  ///
  const account = useAccount();

  /// Query: Quorum
  const quorum = useProposalBlockData(proposal, account);

  return (
    <Container maxWidth="lg">
      <Stack gap={2}>
        <PagePath
          items={[
            { path: '/governance', title: 'Governance' },
            {
              path: `/governance/${proposal.id}`,
              title: getCrumbTitle(proposal.title),
            },
          ]}
        />
        <Grid
          container
          wrap="nowrap"
          direction={{ xs: 'column-reverse', md: 'row' }}
          spacing={{ xs: 0, md: 2 }}
          gap={{ xs: 2, md: 0 }}
          maxWidth="100%"
        >
          <Grid item xs={12} md={8} maxWidth="100% !important">
            <ProposalContent proposal={proposal} quorum={quorum} />
          </Grid>
          <Grid item xs={12} md={4} zeroMinWidth>
            <GovernanceActions proposal={proposal} quorum={quorum} />
          </Grid>
        </Grid>
      </Stack>
    </Container>
  );
};

const ProposalPage: FC<{}> = () => {
  /// Routing
  const { id } = useParams<{ id: string }>();

  const oldBip = id?.startsWith('bip-');
  const bipNumber = oldBip ? id?.replace('bip-', '') : null;

  /// Query: Proposal
  const { loading, error, data } = useProposalQuery({
    variables: { proposal_id: id || '' },
    context: { subgraph: 'snapshot' },
    fetchPolicy: 'cache-and-network',
    nextFetchPolicy: 'network-only',
    skip: oldBip,
  });

  const [oldBipData, setOldBipData] = useState<Proposal>();
  const [loadingOldBip, setLoadingOldBip] = useState<boolean>(true);
  useEffect(() => {
    (async () => {
      try {
        if (oldBip) {
          const bip = await fetch(`/.netlify/functions/proposal?getOldBip=${bipNumber}`)
            .then((response) => response.json())
          setOldBipData(bip);
          setLoadingOldBip(false);
        }
      } catch (err) {
        console.error(err);
      }
    })();
  }, [oldBip, bipNumber]);

  const proposal = (oldBip ? oldBipData : data?.proposal) as Proposal;

  /// Loading or Error
  if ((oldBip ? loadingOldBip : loading) || error) {
    return (
      <>
        {error ? (
          <Card>
            <Box
              height={300}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Typography>Error: {error.message}</Typography>
            </Box>
          </Card>
        ) : (
          <Box
            height={300}
            display="flex"
            alignItems="center"
            justifyContent="center"
          >
            <CircularProgress />
          </Box>
        )}
      </>
    );
  }

  /// Finished loading but no proposal
  if (((oldBip ? !loading : !loadingOldBip) && data?.proposal === null) || !id) {
    return <PageNotFound />;
  }

  return <ProposalPageInner proposal={proposal} />;
};

export default ProposalPage;
