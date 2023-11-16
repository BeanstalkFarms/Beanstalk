import { Box, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import React, { useCallback, useMemo } from 'react';
import useFarmerBalancesBreakdown from '~/hooks/farmer/useFarmerBalancesBreakdown';
import { AppState } from '~/state';

import useTabs from '~/hooks/display/useTabs';
import TokenIcon from '~/components/Common/TokenIcon';
import { SEEDS, STALK } from '~/constants/tokens';
import {
  displayPercentage,
  displayStalk,
  displayUSD,
} from '~/util';
import { ChipLabel, StyledTab } from '~/components/Common/Tabs';
import { ZERO_BN } from '~/constants';
import Row from '~/components/Common/Row';
import useAccount from '~/hooks/ledger/useAccount';
import { Module, ModuleTabs } from '~/components/Common/Module';
import OverviewPlot from '~/components/Silo/OverviewPlot';
import Stat from '~/components/Common/Stat';
import useFarmerSiloHistory from '~/hooks/farmer/useFarmerSiloHistory';
import { FC } from '~/types';
import { BaseDataPoint } from '~/components/Common/Charts/ChartPropProvider';
import useMigrationNeeded from '~/hooks/farmer/useMigrationNeeded';
import stalkIconWinter from '~/img/beanstalk/stalk-icon-green.svg';
import seedIconWinter from '~/img/beanstalk/seed-icon-green.svg';
import { MigrateTab } from '~/components/Silo/MigrateTab';
import useFarmerSiloBalances from '~/hooks/farmer/useFarmerSiloBalances';

const depositStats = (s: BigNumber, v: BigNumber[], d: string) => (
  <Stat
    title="Value Deposited"
    titleTooltip={
      <>
        The historical USD value of your Silo Deposits. <br />
        <Typography variant="bodySmall">
          Note: Unripe assets are valued based on the current Chop Rate. Earned
          Beans are shown upon Plant.
        </Typography>
      </>
    }
    color="primary"
    subtitle={`Season ${s.toString()}`}
    secondSubtitle={d}
    amount={displayUSD(v[0])}
    amountIcon={undefined}
    gap={0.25}
    sx={{ ml: 0 }}
  />
);

const seedsStats = (s: BigNumber, v: BigNumber[], d: string) => (
  <Stat
    title="Seed Balance"
    titleTooltip="Seeds are illiquid tokens that yield 1/10,000 Stalk each Season."
    subtitle={`Season ${s.toString()}`}
    secondSubtitle={d}
    amount={displayStalk(v[0])}
    sx={{ minWidth: 180, ml: 0 }}
    amountIcon={undefined}
    gap={0.25}
  />
);

const SLUGS = ['migrate', 'deposits', 'stalk', 'seeds'];
const altSLUGS = ['deposits', 'stalk', 'seeds'];

const Overview: FC<{
  farmerSilo: AppState['_farmer']['silo'];
  beanstalkSilo: AppState['_beanstalk']['silo'];
  breakdown: ReturnType<typeof useFarmerBalancesBreakdown>;
  season: BigNumber;
}> = ({ farmerSilo, beanstalkSilo, breakdown, season }) => {
  //
  const account = useAccount();
  const { data, loading } = useFarmerSiloHistory(account, false, true);
  const migrationNeeded = useMigrationNeeded();
  const siloBalance = useFarmerSiloBalances();
  //
  const [tab, handleChange] = useTabs(migrationNeeded ? SLUGS : altSLUGS, 'view');

  //
  const ownership =
    farmerSilo.stalk.active?.gt(0) && beanstalkSilo.stalk.total?.gt(0)
      ? farmerSilo.stalk.active.div(beanstalkSilo.stalk.total)
      : ZERO_BN;

  const deposits = Object.values(siloBalance).map(token => token.deposited.crates).flat(Infinity)

  let totalStalkGrown = farmerSilo.stalk.grown;

  deposits.forEach((deposit: any) => {
    totalStalkGrown = totalStalkGrown.plus(deposit.stalk.grown)
  })

  const stalkStats = useCallback(
    (s: BigNumber, v: BigNumber[], d: string) => (
      <>
        <Stat
          title="Stalk Balance"
          titleTooltip="Stalk is the governance token of the Beanstalk DAO. Stalk entitles holders to passive interest in the form of a share of future Bean mints, and the right to propose and vote on BIPs. Your Stalk is forfeited when you Withdraw your Deposited assets from the Silo."
          subtitle={`Season ${s.toString()}`}
          secondSubtitle={d}
          amount={displayStalk(v[0])}
          color="text.primary"
          sx={{ minWidth: 220, ml: 0 }}
          gap={0.25}
        />
        <Stat
          title="Stalk Ownership"
          titleTooltip="Your current ownership of Beanstalk is displayed as a percentage. Ownership is determined by your proportional ownership of the total Stalk supply."
          amount={displayPercentage(ownership.multipliedBy(100))}
          color="text.primary"
          gap={0.25}
          sx={{ minWidth: 200, ml: 0 }}
        />
        <Stat
          title="Total Stalk Grown"
          titleTooltip="The total number of Mown and Mowable Grown Stalk your Deposits have accrued."
          amount={displayStalk(
            totalStalkGrown
          )}
          color="text.primary"
          gap={0.25}
          sx={{ minWidth: 120, ml: 0 }}
        />
      </>
    ),
    [ownership, totalStalkGrown]
  );

  return (
    <Module>
      <ModuleTabs value={tab} onChange={handleChange} sx={{ minHeight: 0 }}>
        {migrationNeeded && (
          <StyledTab label={<ChipLabel name="Silo V3">Migrate</ChipLabel>} />
        )}
        <StyledTab
          label={
            <ChipLabel name="Deposits">
              {breakdown.states.deposited.value.gt(0)
                ? displayUSD(breakdown.states.deposited.value)
                : '?'}
            </ChipLabel>
          }
        />
        <StyledTab
          label={
            <ChipLabel name="Stalk">
              <Row alignItems="center">
                <TokenIcon token={STALK} logoOverride={stalkIconWinter} />{' '}
                {displayStalk(farmerSilo.stalk.active, 0)}
              </Row>
            </ChipLabel>
          }
        />
        <StyledTab
          label={
            <ChipLabel name="Seeds">
              <Row alignItems="center">
                <TokenIcon token={SEEDS} logoOverride={seedIconWinter} />{' '}
                {displayStalk(farmerSilo.seeds.active, 0)}
              </Row>
            </ChipLabel>
          }
        />
      </ModuleTabs>
      {migrationNeeded && (
        <Box
          sx={{
            display: tab === 0 ? 'block' : 'none',
            minHeight: '400px',
            backgroundColor: 'rgba(244, 244, 244, 0.4)',
          }}
        >
          <MigrateTab />
        </Box>
      )}
      <Box sx={{ display: tab === (migrationNeeded ? 1 : 0) ? 'block' : 'none' }}>
        <OverviewPlot
          label="Silo Deposits"
          account={account}
          current={useMemo(
            () => [breakdown.states.deposited.value],
            [breakdown.states.deposited.value]
          )}
          date={
            data.deposits[data.deposits.length - 1]
              ? data.deposits[data.deposits.length - 1].date
              : ''
          }
          series={
            useMemo(() => [data.deposits], [data.deposits]) as BaseDataPoint[][]
          }
          season={season}
          stats={depositStats}
          loading={loading}
          empty={breakdown.states.deposited.value.eq(0)}
        />
      </Box>
      <Box sx={{ display: tab === (migrationNeeded ? 2 : 1) ? 'block' : 'none' }}>
        <OverviewPlot
          label="Stalk Ownership"
          account={account}
          current={useMemo(
            () => [
              farmerSilo.stalk.active,
              // Show zero while these data points are loading
              ownership,
            ],
            [farmerSilo.stalk.active, ownership]
          )}
          date={
            data.stalk[data.stalk.length - 1]
              ? data.stalk[data.stalk.length - 1].date
              : ''
          }
          series={useMemo(
            () => [
              data.stalk,
              // mockOwnershipPctData
            ],
            [data.stalk]
          )}
          season={season}
          stats={stalkStats}
          loading={loading}
          empty={farmerSilo.stalk.total.lte(0)}
        />
      </Box>
      <Box sx={{ display: tab === (migrationNeeded ? 3 : 2) ? 'block' : 'none' }}>
        <OverviewPlot
          label="Seeds Ownership"
          account={account}
          current={useMemo(
            () => [farmerSilo.seeds.active],
            [farmerSilo.seeds.active]
          )}
          series={useMemo(() => [data.seeds], [data.seeds])}
          date={
            data.seeds[data.seeds.length - 1]
              ? data.seeds[data.seeds.length - 1].date
              : ''
          }
          season={season}
          stats={seedsStats}
          loading={loading}
          empty={farmerSilo.seeds.total.lte(0)}
        />
      </Box>
    </Module>
  );
};

export default Overview;
