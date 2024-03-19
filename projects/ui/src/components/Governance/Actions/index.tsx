import React from 'react';
import { Alert, Box, Link, Typography } from '@mui/material';
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
  const isBip23 = props.proposal.id === "0x3b2a7808f01960ff993b7aec4df9ef6a3434d0ef0843828ea6c6bce4e768e6a9";

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
        {isBip23 &&
        <Module sx={{ marginBottom: 2 }}>
          <Alert color="warning" icon={false} sx={{ p: 1 }}>
            <Typography>
              Due to significant Withdrawals during the BIP-23 Voting Period, the total Stalk supply and thus quorum decreased such that the BIP did pass.
            </Typography>
            <br/>
            <Typography>
              However, Snapshot does not support this functionality and thus the data shown on this page is slightly inaccurate.
            </Typography>
          </Alert>
        </Module>
        }
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
