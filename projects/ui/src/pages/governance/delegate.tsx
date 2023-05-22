import { Card, Container, Link, Stack, Typography } from '@mui/material';

import React from 'react';
import { useParams } from 'react-router-dom';

import PagePath from '~/components/Common/PagePath';
import Delegation from '~/components/Governance/Delegate/Delegation';
import { GovSpace } from '~/lib/Beanstalk/Governance';
import { getGovSpaceWithSlug } from '~/util';

const FarmerDelegatePage: React.FC<{}> = () => {
  const { type: govSlug } = useParams();

  const space = getGovSpaceWithSlug(govSlug || '');

  if (!govSlug || !space) return null;

  const isNFT = govSlug === GovSpace.BeanNFT;

  return (
    <Container sx={{ width: '100%', maxWidth: '580px !important' }}>
      <Stack gap={2}>
        <PagePath
          items={[
            { path: `/governance?type=${govSlug}`, title: 'Governance' },
            { path: `/governance/delegate/${govSlug}`, title: 'Delegation' },
          ]}
        />
        <Card>
          <Stack p={2} gap={2}>
            <Stack gap={1}>
              <Typography variant="h4">Change your Delegate</Typography>
              <Typography color="text.secondary">
                Delegate your {isNFT ? 'BeaNFT' : 'Stalk'} votes on&nbsp;
                <Typography component="span" variant="h4" color="inherit">
                  {space.toString()}
                </Typography>
                .&nbsp;
                <Link
                  component="a"
                  href="https://discord.com/channels/880413392916054098/1092912362295668828"
                  rel="noreferrer"
                  target="_blank"
                  variant="inherit"
                >
                  View delegates
                </Link>
              </Typography>
            </Stack>
            <Delegation space={space} />
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
};

export default FarmerDelegatePage;
