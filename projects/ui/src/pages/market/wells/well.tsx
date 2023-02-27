import React from 'react';
import { Container, Grid, Stack, Typography } from '@mui/material';
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
import { useParams } from 'react-router-dom';
import useWell from '~/hooks/wells/useWell';

// Wells Detail page
// Once you click on a Liquidity Well
const WellPage: React.FC = () => {
  /// Routing
  const { id } = useParams<{ id: string }>();
  if (!id) throw Error('Oh well'); // TODO LOL

  const { well } = useWell(id);

  return (
    <Container maxWidth="lg">
      <Stack gap={2}>
        <PagePath
          items={[
            {
              title: 'Market',
              path: '/',
            },
            {
              title: 'Well Explorer',
              path: '/market/wells',
            },
            {
              title: 'BEAN:ETH Liquidity Well',
              path: `/market/wells/${id}`,
            },
          ]}
        />
        <PageHeader
          title={
            <Row gap={1}>
              <Row gap={0.2}>
                <img alt="" src={beanIcon} height={IconSize.medium} />
                <img alt="" src={ethIcon} height={IconSize.medium} />
              </Row>
              <Typography
                variant="h2"
                textAlign="center"
                sx={{ verticalAlign: 'middle' }}
              >
                {well!.name}
              </Typography>
            </Row>
          }
          control={<WellButtons />}
        />
        <Grid container spacing={2}>
          <Grid item xs={12} md={6} lg={4}>
            <WellReserves wellId={id!} />
          </Grid>
          <Grid item xs={12} md={6} lg={8}>
            <WellCharts wellId={id!} />
          </Grid>
        </Grid>
        <WellActivity wellId={id} />
      </Stack>
    </Container>
  );
};

export default WellPage;
