import React from 'react';
import {
  Container, Grid,
  Stack, Typography
} from '@mui/material';
import BigNumber from 'bignumber.js';
import Row from '~/components/Common/Row';
import { IconSize } from '~/components/App/muiTheme';
import WellCharts from '~/components/Market/Wells/Charts';
import WellActivity from '~/components/Market/Wells/Tables';
import WellButtons from '~/components/Market/Wells/WellButtons';
import beanIcon from '~/img/tokens/bean-logo-circled.svg';
import ethIcon from '~/img/tokens/eth-logo-circled.svg';
import { Module } from '~/components/Common/Module';
import WellReserves from '~/components/Market/Wells/WellReserves';
import PageHeader from '~/components/Common/PageHeader';
import WellStat from '~/components/Market/Wells/WellStat';
import stalkIcon from '~/img/beanstalk/stalk-icon.svg';
import { displayBN } from '~/util';
import PagePath from '~/components/Common/PagePath';

const WellPage: React.FC = () => (
  <Container maxWidth="lg">
    <Stack gap={2}>
      <PagePath
        items={[
          {
            title: 'Market',
            path: '/'
          },
          {
            title: 'Well Explorer',
            path: '/'
          },
          {
            title: 'BEAN:ETH Liquidity Well',
            path: '/'
          }
        ]}
      />
      <PageHeader
        title={
          <Row gap={1}>
            <Row gap={0.2}>
              <img alt="" src={beanIcon} height={IconSize.medium} />
              <img alt="" src={ethIcon} height={IconSize.medium} />
            </Row>
            <Typography variant="h2" textAlign="center" sx={{ verticalAlign: 'middle' }}>BEAN:ETH Liquidity
              Well
            </Typography>
          </Row>
        }
        control={<WellButtons />}
      />
      <Grid container spacing={2}>
        <Grid item xs={12} md={6} lg={8}>
          <WellCharts />
        </Grid>
        <Grid item xs={12} md={6} lg={4}>
          <WellReserves />
        </Grid>
      </Grid>
      <Module sx={{ p: 2 }}>
        <Grid container>
          <Grid item xs={6} md={1.75}>
            <WellStat
              title="Type"
              subTitle={
                <Typography variant="h4">
                  Constant Product
                </Typography>
              }
            />
          </Grid>
          <Grid item xs={6} md={1.5}>
            <WellStat
              title="Exchange Fees"
              subTitle={
                <Typography variant="h4">
                  0.00%
                </Typography>
              }
            />
          </Grid>
          <Grid item xs={6} md={1.5}>
            <WellStat
              title="Rewards per BDV"
              subTitle={
                <Row>
                  <img src={stalkIcon} alt="" height={IconSize.small} />
                  <Typography variant="h4">
                    {displayBN(new BigNumber(5))}
                  </Typography>
                </Row>
              }
            />
          </Grid>
          <Grid item xs={6} md={2.75}>
            <WellStat
              title="Beans Earned by Depositors (7D)"
              subTitle={
                <Typography variant="h4">
                  Constant Product
                </Typography>
              }
            />
          </Grid>
          <Grid item xs={6} md={2.75}>
            <WellStat
              title="Stalk Grown by Depositors (7D)"
              subTitle={
                <Typography variant="h4">
                  Constant Product
                </Typography>
              }
            />
          </Grid>
          <Grid item xs={6} md={1.75}>
            <WellStat
              title="Well Address"
              subTitle={
                <Typography variant="h4">
                  Constant Product
                </Typography>
              }
            />
          </Grid>
        </Grid>
      </Module>
      <WellActivity />
    </Stack>
  </Container>
);

export default WellPage;
