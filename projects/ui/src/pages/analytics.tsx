import { Container, Stack } from '@mui/material';
import React from 'react';
import BeanAnalytics from '~/components/Analytics/Bean';
import FieldAnalytics from '~/components/Analytics/Field';
import SiloAnalytics from '~/components/Analytics/Silo';
import PageHeader from '~/components/Common/PageHeader';

import { FC } from '~/types';

const AnalyticsPage: FC<{}> = () => (
  <Container maxWidth="lg">
    <Stack gap={2}>
      <PageHeader
        title="Analytics"
        description="View historical data on Beanstalk"
        href="https://analytics.bean.money/"
      />
      <BeanAnalytics />
      <SiloAnalytics />
      <FieldAnalytics />
    </Stack>
  </Container>
);

export default AnalyticsPage;
