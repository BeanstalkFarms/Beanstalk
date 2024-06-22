import { Container, Stack, useMediaQuery, useTheme } from '@mui/material';
import React from 'react';
import AdvancedChart from '~/components/Analytics/AdvancedChart';
import MiniCharts from '~/components/Analytics/MiniCharts';
import PageHeader from '~/components/Common/PageHeader';

import { FC } from '~/types';

const AnalyticsPage: FC<{}> = () => {

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  
  return (
  <Container sx={{ maxWidth: `92% !important`, width: '100%', maxHeight: `92% !important` }}>
    <Stack gap={2}>
      <PageHeader
        title="Analytics"
        description="View historical data on Beanstalk"
        href="https://docs.bean.money/almanac/community/links#analytics"
      />
      {!isMobile && <MiniCharts />}
      <AdvancedChart isMobile={isMobile} />
    </Stack>
  </Container>
)};

export default AnalyticsPage;
