import React from 'react';
import { CardProps, Card, CircularProgress } from '@mui/material';
import { useSelector } from 'react-redux';
import Stat from '../Common/Stat';
import { displayFullBN } from '../../util';
import StatsCard, { StatItem } from '~/components/Common/StatsCard';
import { SEEDS, SPROUTS, STALK, PODS } from '~/constants/tokens';
import { AppState } from '~/state';
import BeanstalkBalances from '~/components/Common/Balances/BeanstalkBalances';
import useBeanstalkSiloBreakdown from '~/hooks/beanstalk/useBeanstalkBalancesBreakdown';
import { NEW_BN } from '~/constants';

import { FC } from '~/types';

const LiquidityByState: FC<CardProps> = ({ sx }) => {
  const breakdown = useBeanstalkSiloBreakdown();
  const beanstalkSilo = useSelector<AppState, AppState['_beanstalk']['silo']>((state) => state._beanstalk.silo);
  const beanstalkField = useSelector<AppState, AppState['_beanstalk']['field']>((state) => state._beanstalk.field);
  const beanstalkBarn = useSelector<AppState, AppState['_beanstalk']['barn']>((state) => state._beanstalk.barn);
  const totalBeanSupply = useSelector<AppState, AppState['_bean']['token']['supply']>((state) => state._bean.token.supply);

  /// Total Balances
  const STAT_ITEMS: StatItem[] = [
    {
      title: 'Stalk',
      tooltip: 'This is the total Stalk supply. Stalk is the governance token of the Beanstalk DAO. Stalk entitles holders to passive interest in the form of a share of future Bean mints, and the right to propose and vote on BIPs.',
      token: STALK,
      amount: beanstalkSilo.stalk.total
    },
    {
      title: 'Seeds',
      tooltip: 'This is the total Seed supply. Each Seed yields 1/10000 Grown Stalk each Season.',
      token: SEEDS,
      amount: beanstalkSilo.seeds.total
    },
    {
      title: 'Pods',
      tooltip: 'This is the total Pod supply. Pods become Harvestable on a FIFO basis.',
      token: PODS,
      amount: beanstalkField.podLine
    },
    {
      title: 'Sprouts',
      tooltip: 'This is the total Sprout supply. Sprouts are the number of Beans left to be earned from Active Fertilizer. Sprouts become Rinsable on a pari passu basis.',
      token: SPROUTS,
      amount: beanstalkBarn.unfertilized,
    }
  ];

  return (
    <Card sx={{ p: 2, width: '100%', ...sx }}>
      <Stat
        title="Bean Supply"
        amount={totalBeanSupply !== NEW_BN ? displayFullBN(totalBeanSupply, 2) : <CircularProgress variant="indeterminate" size="1.2em" thickness={4} />}
        gap={0.25}
        sx={{ ml: 0 }}
      />
      <BeanstalkBalances breakdown={breakdown} />
      <StatsCard stats={STAT_ITEMS} />
    </Card>
  );
};

export default LiquidityByState;
