import React from 'react';
import { Card, Container, Grid, Stack, Tab, Tabs } from '@mui/material';
import BigNumber from 'bignumber.js';
import { useSelector } from 'react-redux';
import Stat from '~/components/Common/Stat';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import AmountRaisedCard from '~/components/Analytics/Barn/AmountRaisedCard';
import ComingSoonCard from '~/components/Common/ZeroState/ComingSoonCard';
import useChainId from '~/hooks/chain/useChainId';
import useTabs from '~/hooks/display/useTabs';
import { displayBN } from '~/util';
import { SupportedChainId } from '~/constants';
import { AppState } from '~/state';

import { FC } from '~/types';

const BarnraiseAnalytics: FC<{}> = () => {
  const fertilizer = useSelector<
    AppState,
    AppState['_beanstalk']['barn']
  >((state) => state._beanstalk.barn);

  const chainId = useChainId();
  const [tab, handleChangeTab] = useTabs();

  if (chainId === SupportedChainId.MAINNET) {
    return (
      <Container maxWidth="lg">
        <ComingSoonCard title="Barn Raise Analytics" />
      </Container>
    );
  }
  
  return (
    <Container maxWidth="lg">
      <Stack gap={2}>
        <AmountRaisedCard totalRaised={fertilizer.totalRaised} />
        <Grid container direction="row" spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 2 }}>
              <Stat
                title="Total Outstanding Debt"
                amount={`${displayBN(new BigNumber(10000000))}`}
              />
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 2 }}>
              <Stat
                title="Total Debt Repaid"
                amount={`${displayBN(new BigNumber(10000000))}`}
              />
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 2 }}>
              <Stat
                title="Current Penalty for Ripening"
                color={BeanstalkPalette.washedRed}
                amount={`${displayBN(new BigNumber(95))}%`}
              />
            </Card>
          </Grid>
        </Grid>
        <Card>
          <Stack>
            <Tabs value={tab} onChange={handleChangeTab} sx={{ px: 2, pt: 2 }}>
              <Tab label="All Fertilizer" />
              <Tab label="All Unripe Assets" />
              <Tab label="Forfeitures" />
            </Tabs>
            {/* {tab === 0 && <AllFertilizer season={season} beanPrice={beanPrice} />}
            {tab === 1 && <AllUnripeAssets season={season} beanPrice={beanPrice} />}
            {tab === 2 && <Forfeitures season={season} beanPrice={beanPrice} />} */}
          </Stack>
        </Card>
      </Stack>
    </Container>
  );
};

export default BarnraiseAnalytics;
