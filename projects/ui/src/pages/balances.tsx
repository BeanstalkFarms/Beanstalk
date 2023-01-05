import React from 'react';
import { Box, Card, Container, Stack, Typography } from '@mui/material';
import { XXLWidth } from '~/components/App/muiTheme';
import { FC } from '~/types';
import TokenBalanceCards from '~/components/Balances/TokenBalanceCards';
import BalancesActions from '~/components/Balances/Actions';
import BalancesHeader from '~/components/Balances/Header';
import SiloBalancesHistory from '~/components/Balances/SiloBalancesHistory';
import SiloBalances from '~/components/Balances/SiloBalances';

const BalancesPage: FC<{}> = () => (
  <Container sx={{ maxWidth: `${XXLWidth}px !important`, width: '100%' }}>
    <Stack gap={2}>
      <Stack width={{ xs: '100%', lg: 'calc(100% - 380px)' }} gap={0.5}>
        <Typography variant="h1">Balances</Typography>
        <BalancesHeader />
      </Stack>
      <Stack gap={2} direction="row">
        <Stack sx={{ minWidth: 0 }} width="100%" gap={2}>
          <Card sx={{ pt: 2, pb: 0 }}>
            <SiloBalancesHistory />
          </Card>
          {/* Deposit Balances */}
          <Card>
            <SiloBalances />
          </Card>

          {/* Actions: Quick Harvest, Quick Rinse, & Silo Rewards */}
          <Box display={{ xs: 'block', lg: 'none' }}>
            <BalancesActions />
          </Box>
          {/* Farm & Circulating Balances */}
          <TokenBalanceCards />
        </Stack>

        {/* Actions: Quick Harvest, Quick Rinse, & Silo Rewards */}
        <Box
          display={{ xs: 'none', lg: 'block' }}
          sx={{ position: 'relative' }}
        >
          <BalancesActions />
        </Box>
      </Stack>
    </Stack>
  </Container>
);

export default BalancesPage;
