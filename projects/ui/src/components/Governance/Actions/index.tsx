import React from 'react';
import { Box, Typography } from '@mui/material';
import Vote from '~/components/Governance/Actions/Vote';
import {
  Module,
  ModuleContent,
  ModuleHeader,
} from '~/components/Common/Module';
import { Proposal } from '~/util/Governance';

import { FC } from '~/types';
import useProposalBlockData from '~/hooks/beanstalk/useProposalBlockData';
import ListOfVotes from './ListOfVotes';

const GovernanceActions: FC<{
  proposal: Proposal;
  quorum: ReturnType<typeof useProposalBlockData>;
}> = (props) => {

  const isOldBip = props.proposal.id.startsWith("bip-");
  const isEbip = props.proposal.id.startsWith("ebip-");

  if (isEbip || isOldBip) return null;

  return (
  <Box sx={{ position: 'sticky', top: 120 }}>
    <Module>
      <ModuleHeader>
        <Typography variant="h4">Vote</Typography>
      </ModuleHeader>
      <ModuleContent>
        <Vote proposal={props.proposal} quorum={props.quorum} />
      </ModuleContent>
    </Module>
    <Module sx={{ marginTop: isOldBip ? 0 : 2 }}>
      <ListOfVotes proposal={props.proposal} quorum={props.quorum} />
    </Module>
  </Box>
  )
};

export default GovernanceActions;
