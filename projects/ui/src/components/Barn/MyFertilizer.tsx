import React, { useCallback, useMemo } from 'react';
import {
  Box,
  Card,
  Divider,
  Grid,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from '@mui/material';
import { useSelector } from 'react-redux';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FertilizerItem from '~/components/Barn/FertilizerItem';
import { MY_FERTILIZER } from '~/components/Barn/FertilizerItemTooltips';
import useTabs from '~/hooks/display/useTabs';
import EmptyState from '~/components/Common/ZeroState/EmptyState';
import { displayFullBN, MaxBN, MinBN } from '~/util/Tokens';
import { SPROUTS, RINSABLE_SPROUTS } from '~/constants/tokens';
import { ONE_BN, ZERO_BN } from '~/constants';
import { AppState } from '~/state';
import TokenIcon from '../Common/TokenIcon';
import { FontSize } from '../App/muiTheme';
import { FertilizerBalance } from '~/state/farmer/barn';
import Row from '~/components/Common/Row';

import { FC } from '~/types';

enum TabState {
  ACTIVE = 0,
  USED = 1,
}

const MyFertilizer: FC<{}> = () => {
  /// Data
  const beanstalkBarn = useSelector<AppState, AppState['_beanstalk']['barn']>((state) => state._beanstalk.barn);
  const farmerBarn = useSelector<AppState, AppState['_farmer']['barn']>((state) => state._farmer.barn);

  /// Helpers
  const [tab, handleChange] = useTabs();
  const pctRepaid = useCallback((balance: FertilizerBalance) => (
    MinBN(
      (beanstalkBarn.currentBpf.minus(balance.token.startBpf))
        .div(balance.token.id.minus(balance.token.startBpf)),
      ONE_BN
    )
  ), [beanstalkBarn.currentBpf]);

  const filteredBalances = useMemo(() => farmerBarn.balances?.filter((balance) => {
    const pct = pctRepaid(balance);
    if (tab === TabState.ACTIVE && pct.gte(1)) return false;
    if (tab === TabState.USED && pct.lt(1)) return false;
    return true;
  }) || [], [farmerBarn.balances, pctRepaid, tab]);

  return (
    <Card>
      {/* Card Header */}
      <Stack sx={{ p: 2 }} gap={1}>
        <Typography variant="h4">Fertilizer</Typography>
        <Stack gap={1}>
          <Row
            alignItems="center"
            justifyContent="space-between"
          >
            <Tooltip
              title="The number of Beans left to be earned from your Fertilizer. Sprouts become Rinsable on a pari passu basis."
              placement="bottom"
            >
              <Typography variant="body1">
                Sprouts&nbsp;
                <HelpOutlineIcon
                  sx={{ color: 'text.secondary', fontSize: FontSize.sm }}
                />
              </Typography>
            </Tooltip>
            <Row alignItems="center" gap={0.2}>
              <TokenIcon token={SPROUTS} />
              <Typography>
                {displayFullBN(
                  MaxBN(farmerBarn.unfertilizedSprouts, ZERO_BN), SPROUTS.displayDecimals
                )}
              </Typography>
            </Row>
          </Row>
          <Row
            alignItems="center"
            justifyContent="space-between"
          >
            <Tooltip
              title="Sprouts that are redeemable for 1 Bean each. Rinsable Sprouts must be Rinsed in order to use them."
              placement="bottom"
            >
              <Typography variant="body1">
                Rinsable Sprouts&nbsp;
                <HelpOutlineIcon
                  sx={{ color: 'text.secondary', fontSize: FontSize.sm }}
                />
              </Typography>
            </Tooltip>
            <Row alignItems="center" gap={0.2}>
              <TokenIcon token={RINSABLE_SPROUTS} />
              <Typography>
                {displayFullBN(
                  MaxBN(farmerBarn.fertilizedSprouts, ZERO_BN), RINSABLE_SPROUTS.displayDecimals
                )}
              </Typography>
            </Row>
          </Row>
        </Stack>
      </Stack>
      <Divider />
      {/* Fertilizers */}
      <Stack sx={{ px: 2, pb: 2, pt: 1 }} spacing={0}>
        <Row
          justifyContent="space-between"
          alignItems="center"
          sx={{ pt: 1, pb: 2 }}
        >
          <Tabs value={tab} onChange={handleChange} sx={{ minHeight: 0 }}>
            <Tab label="Active" />
            <Tab label="Used" />
          </Tabs>
        </Row>
        <Box>
          {filteredBalances.length > 0 ? (
            <Grid container spacing={3}>
              {filteredBalances.map((balance) => {
                const pct = pctRepaid(balance);
                const status = pct.eq(1) ? 'used' : 'active';
                const humidity = balance.token.humidity;
                const debt = balance.amount.multipliedBy(humidity.div(100).plus(1));
                const sprouts = debt.multipliedBy(ONE_BN.minus(pct));
                const rinsableSprouts = debt.multipliedBy(pct);
                return (
                  <Grid key={balance.token.id.toString()} item xs={12} md={4}>
                    <FertilizerItem
                      id={balance.token.id}
                      season={balance.token.season}
                      state={status}
                      humidity={humidity.div(100)}
                      amount={balance.amount} // of FERT
                      rinsableSprouts={rinsableSprouts} // rinsable sprouts
                      sprouts={sprouts} // sprouts
                      progress={pct.toNumber()}
                      tooltip={MY_FERTILIZER}
                    />
                  </Grid>
                );
              })}
            </Grid>
          ) : (
            <EmptyState message={`Your ${tab === 0 ? 'Active' : 'Used'} Fertilizer will appear here.`} height={150} />
          )}
        </Box>
      </Stack>
    </Card>
  );
};

export default MyFertilizer;
