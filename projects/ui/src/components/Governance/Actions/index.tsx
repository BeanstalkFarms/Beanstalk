import React from 'react';
import { Box, Link, Typography } from '@mui/material';
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

  return (
  <Box sx={{ position: 'sticky', top: 120 }}>
    {isEbip || isOldBip ? (
      <Module sx={{ p: 2 }}>
        {isOldBip && 
        <>
          <Typography variant="h4">Beanstalk governance was on-chain before the April 2022 Governance exploit.</Typography>
            <br/>
          <Typography variant="h4">Read more <Link underline="hover" href="https://bean.money/beanstalk.pdf#subsection.14.3">here</Link>.</Typography>
        </>
        }
        {isEbip && 
        <>
          <Typography variant="h4">EBIPs are emergency upgrades to Beanstalk to address a bug or vulnerability.</Typography>
            <br/>
          <Typography variant="h4">Read more <Link underline="hover" href="https://docs.bean.money/almanac/governance/beanstalk/bcm-process#emergency-response-procedures">here</Link>.</Typography>
        </>
        }
      </Module>
    ) : (
      <>
        <Module>
          <ModuleHeader>
            <Typography variant="h4">Vote</Typography>
          </ModuleHeader>
          <ModuleContent>
            <Vote proposal={props.proposal} quorum={props.quorum} />
          </ModuleContent>
        </Module>
        <Module sx={{ marginTop: 2 }}>
          <ListOfVotes proposal={props.proposal} quorum={props.quorum} />
        </Module>
      </>
    )}
  </Box>
  )
};

export default GovernanceActions;
