import React from 'react';
import { Card, Container, Stack } from '@mui/material';

import PageHeader from '~/components/Common/PageHeader';
import LiquidityOverTime from '~/components/Forecast/LiquidityOverTime';
import Price from '~/components/Analytics/Bean/Price';
import PodRate from '~/components/Analytics/Field/PodRate';
import LiquidityByState from '~/components/Forecast/LiquidityByState';
import MarketCap from '~/components/Analytics/Bean/MarketCap';

import { FC } from '~/types';

const ForecastPage: FC<{}> = () => (
  <Container maxWidth="lg">
    <Stack gap={2}>
      <PageHeader title="Forecast" description="View conditions on the Farm" />
      <Stack direction={{ md: 'row', xs: 'column' }} gap={2}>
        <Card sx={{ flex: 1, pt: 2 }}>
          <Price />
        </Card>
        <Card sx={{ flex: 1, pt: 2 }}>
          <PodRate />
        </Card>
      </Stack>
      <LiquidityOverTime />
      <Card sx={{ pt: 2 }}>
        <MarketCap height={250} />
      </Card>
      <LiquidityByState />
    </Stack>
  </Container>
);

export default ForecastPage;
