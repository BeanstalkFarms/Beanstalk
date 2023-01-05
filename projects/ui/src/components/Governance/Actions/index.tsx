import React from 'react';
import { Typography } from '@mui/material';
import Vote from '~/components/Governance/Actions/Vote';
import { Module, ModuleContent, ModuleHeader } from '~/components/Common/Module';
import { Proposal } from '~/util/Governance';

import { FC } from '~/types';
import useProposalBlockData from '~/hooks/beanstalk/useProposalBlockData';

const GovernanceActions : FC<{
  proposal: Proposal;
  quorum: ReturnType<typeof useProposalBlockData>;
}> = (props) => (
  <Module sx={{ position: 'sticky', top: 120 }}>
    <ModuleHeader>
      <Typography variant="h4">Vote</Typography>
    </ModuleHeader>
    <ModuleContent>
      <Vote
        proposal={props.proposal}
        quorum={props.quorum}
      />
    </ModuleContent>
  </Module>
);

export default GovernanceActions;
