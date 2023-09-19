import { Card, Container, Stack } from '@mui/material';
import React from 'react';
import { useParams } from 'react-router-dom';
import PagePath from '~/components/Common/PagePath';
import VotingPowerTable from '~/components/Governance/Delegate/VotingPowerTable';
import { getGovSpaceWithSlug } from '~/util';

const VotingPowerPage: React.FC<{}> = () => {
  const { id: govSlug } = useParams();

  const space = getGovSpaceWithSlug(govSlug || '');

  if (!govSlug || !space) return null;

  return (
    <Container sx={{ maxWidth: '580px !important' }}>
      <Stack gap={2}>
        <PagePath
          items={[
            { path: `/governance?type=${govSlug}`, title: 'Governance' },
            { path: `/governance/vp/${govSlug}`, title: 'Voting Power' },
          ]}
        />
        <Card sx={{ position: 'relative' }}>
          <Stack p={2}>
            <VotingPowerTable space={space} />
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
};

export default VotingPowerPage;
