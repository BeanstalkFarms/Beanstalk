import React from 'react';
import { Container, Stack } from '@mui/material';
import PageHeader from '~/components/Common/PageHeader';
import { HOW_TO_VOTE, VIEW_PAST_GOV_PROPOSALS } from '~/util/Guides';
import GuideButton from '~/components/Common/Guide/GuideButton';

import { FC } from '~/types';
import GovernanceSpaces from '~/components/Governance/GovernanceSpaces';

const GovernancePage: FC<{}> = () => (
  <Container maxWidth="lg">
    <Stack gap={2}>
      <PageHeader
        title="Governance"
        description="Participate in Beanstalk governance"
        href="https://docs.bean.money/almanac/governance/proposals"
        control={
          <GuideButton
            title="The Farmers' Almanac: Governance Guides"
            guides={[HOW_TO_VOTE, VIEW_PAST_GOV_PROPOSALS]}
          />
        }
      />
      <GovernanceSpaces />
    </Stack>
  </Container>
);

export default GovernancePage;
