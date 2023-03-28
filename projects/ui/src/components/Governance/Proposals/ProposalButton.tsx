import React from 'react';
import { Button, Stack, Typography } from '@mui/material';
import { Link as ReactRouterLink } from 'react-router-dom';
import CheckIcon from '@mui/icons-material/Check';
import { useVotesQuery } from '~/generated/graphql';
import useAccount from '~/hooks/ledger/useAccount';
import ProposalStats from '~/components/Governance/Proposals/ProposalStats';
import { BeanstalkPalette, IconSize } from '~/components/App/muiTheme';
import { Proposal } from '~/util/Governance';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

const ProposalButton: FC<{ proposal: Proposal }> = ({ proposal }) => {
  /// State
  const account = useAccount();

  /// Query Votes
  const { data: voteData } = useVotesQuery({
    variables: {
      proposal_id: proposal.id.toLowerCase(),
      voter_address: account || '',
    },
    fetchPolicy: 'cache-and-network',
    skip: !account, // only send query when wallet connected
    context: { subgraph: 'snapshot' }
  });

  /// Time
  const today = new Date();
  const endDate = new Date(proposal.end * 1000);
  const differenceInTime = endDate.getTime() - today.getTime();

  return (
    <Button
      variant="outlined"
      color="secondary"
      component={ReactRouterLink}
      to={`/governance/${proposal.id}`}
      sx={{
        p: 2,
        height: 'auto',
        color: 'text.primary',
        borderColor: 'divider',
        background: BeanstalkPalette.white,
        '&:hover': {
          borderColor: 'primary.main'
        }
      }}
    >
      <Stack gap={1} width="100%">
        {/* Top row */}
        <Stack direction={{ xs: 'column-reverse', md: 'row' }} justifyContent="space-between">
          <Typography display={{ xs: 'none', md: 'block' }} textAlign="left" variant="bodyLarge">
            {proposal.title}
          </Typography>
          <Typography display={{ xs: 'block', md: 'none' }} textAlign="left" variant="bodyLarge" sx={{ fontSize: { xs: '20px', md: 'inherit' }, lineHeight: '24px' }}>
            {proposal.title.substring(0, 55)}{proposal.title.length > 55 ? '...' : null}
          </Typography>
          {/* Show if user has voted */}
          {(account && voteData?.votes?.length) ? (
            <Row gap={0.5}>
              <CheckIcon sx={{ color: BeanstalkPalette.logoGreen, width: IconSize.small }} />
              <Typography variant="body1">Voted</Typography>
            </Row>
          ) : null}
        </Stack>
        {/* Bottom row */}
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between">
          <ProposalStats
            proposal={proposal}
            // totalStalk={totalStalk}
            // quorum={quorum}
            differenceInTime={differenceInTime}
          />
        </Stack>
      </Stack>
    </Button>
  );
};

export default ProposalButton;
