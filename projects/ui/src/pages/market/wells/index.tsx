import React from 'react';
import {
  Card,
  Container,
  Stack
} from '@mui/material';

import PageHeader from '~/components/Common/PageHeader';
import Price from '~/components/Analytics/Bean/Price';
import Wells from '~/components/Market/Wells/Wells';

const WellHomePage: React.FC = () => (
  <Container maxWidth="lg">
    <Stack gap={2}>
      <PageHeader
        title="Reservoir"
        description="Explore Liquidity Wells in the zero-fee DEX."
        />
      <Card sx={{ flex: 1, pt: 2 }}>
        <Price height={350} />
      </Card>
      <Wells />
    </Stack>
  </Container>
  );

export default WellHomePage;
