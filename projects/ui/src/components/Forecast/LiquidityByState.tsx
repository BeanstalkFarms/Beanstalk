import React from 'react';
import { CardProps, Card, CircularProgress } from '@mui/material';
import StatsCard, { StatItem } from '~/components/Common/StatsCard';
import { useAppSelector } from '~/state';
import BeanstalkBalances from '~/components/Common/Balances/BeanstalkBalances';
import useBeanstalkSiloBreakdown from '~/hooks/beanstalk/useBeanstalkBalancesBreakdown';
import { NEW_BN } from '~/constants';

import { FC } from '~/types';
import { useBeanstalkTokens } from '~/hooks/beanstalk/useTokens';
import BigNumber from 'bignumber.js';
import useSdk from '~/hooks/sdk';
import { displayFullBN } from '~/util';
import Stat from '~/components/Common/Stat';

(BigNumber.prototype as any)[Symbol.for('nodejs.util.inspect.custom')] = function logBN() {
  return this.toNumber();
}

const LiquidityByState: FC<CardProps> = ({ sx }) => {
  const sdk = useSdk();
  const totalBeanSupply = useAppSelector((s) => s._bean.token.supply);
  const beanstalkField = useAppSelector((s) => s._beanstalk.field);
  const beanstalkSilo = useAppSelector((s) => s._beanstalk.silo);
  const beanstalkBarn = useAppSelector((s) => s._beanstalk.barn);

  React.useEffect(() => {
    console.log({
      totalBeanSupply,
      beanstalkField,
      beanstalkSilo,
      beanstalkBarn,
    });
  }, [totalBeanSupply, beanstalkField, beanstalkSilo, beanstalkBarn]);

  React.useEffect(() => {
    console.log(sdk.provider);
  }, [sdk.provider]);

  const { STALK, SPROUTS, PODS } = useBeanstalkTokens();
  const breakdown = useBeanstalkSiloBreakdown();

  React.useEffect(() => {
    console.log({ breakdown });
  }, [breakdown]);

  /// Total Balances
  const STAT_ITEMS: StatItem[] = [
    {
      title: 'Stalk',
      tooltip:
        'The total Stalk supply. Stalk is the governance token of the Beanstalk DAO. Stalk entitles holders to passive interest in the form of a share of future Bean mints, and the right to propose and vote on BIPs.',
      token: STALK,
      amount: beanstalkSilo.stalk.total,
    },
    {
      title: 'Pods',
      tooltip:
        'The total number of Unharvestable Pods. Pods become Harvestable on a FIFO basis.',
      token: PODS,
      amount: beanstalkField.podLine,
    },
    {
      title: 'Sprouts',
      tooltip:
        'The total number of Unrinsable Sprouts. Sprouts are the number of Beans left to be earned from Active Fertilizer. Sprouts become Rinsable on a pari passu basis.',
      token: SPROUTS,
      amount: beanstalkBarn.unfertilized,
    },
  ];

  return (
    <Card sx={{ p: 2, width: '100%', ...sx }}>
      <Stat
        title="Bean Supply"
        amount={
          totalBeanSupply !== NEW_BN ? (
            displayFullBN(totalBeanSupply, 2)
          ) : (
            <CircularProgress
              variant="indeterminate"
              size="1.2em"
              thickness={4}
            />
          )
        }
        gap={0.25}
        sx={{ ml: 0 }}
      />
      <BeanstalkBalances breakdown={breakdown} />
      <StatsCard stats={STAT_ITEMS} />
    </Card>
  );
};

export default LiquidityByState;

/* {
  title: 'Seeds',
  tooltip:
    'This is the total Seed supply. Each Seed yields 1/10000 Grown Stalk each Season.',
  token: SEEDS,
  amount: beanstalkSilo.seeds.total,
}, */
