import React from 'react';
import { Box, CircularProgress, Stack } from '@mui/material';
import EmptyState from '~/components/Common/ZeroState/EmptyState';
import ProposalButton from '~/components/Governance/Proposals/ProposalButton';
import { Proposal } from '~/util/Governance';

import { FC } from '~/types';
import { GovSpace } from '~/lib/Beanstalk/Governance';
import DelegationBanner, {
  DelegationBannerProps,
} from '~/components/Governance/Delegate/DelegationBanner';
import VotingPowerBanner from '../Delegate/VotingPowerBanner';
import useAccount from '~/hooks/ledger/useAccount';
import { BeanstalkPalette } from '~/components/App/muiTheme';

type Props = {
  space: GovSpace;
  proposals: Proposal[];
} & DelegationBannerProps;

const ProposalList: FC<Props> = (props) => {
  const account = useAccount();

  // Null state
  if (!props.proposals) {
    return (
      <Box
        height={100}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Stack px={1} pb={1} gap={1}>
      <Stack gap={2} py={account ? 1 : 0}>
        <VotingPowerBanner {...props} />
        <DelegationBanner {...props} />
        <Box
          sx={{
            borderBottom: '0.5px solid',
            borderColor: BeanstalkPalette.blue,
            display: account ? 'block' : 'none',
          }}
        />
      </Stack>
      {props.proposals.length === 0 ? (
        <EmptyState message="No proposals of this type." />
      ) : (
        props.proposals.map((p) => <ProposalButton key={p.id} proposal={p} />)
      )}
    </Stack>
  );
};

export default ProposalList;
