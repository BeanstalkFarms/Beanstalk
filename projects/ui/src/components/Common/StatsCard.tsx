import React from 'react';
import { Card, CardProps, Grid, Typography } from '@mui/material';
import BigNumber from 'bignumber.js';
import Stat from '~/components/Common/Stat';
import TokenIcon from '~/components/Common/TokenIcon';
import { displayFullBN } from '~/util';
import { Token } from '~/classes';
import { BeanstalkPalette }  from '~/components/App/muiTheme';

/**
 * Show a Card with multiple statistics inside.
 * Shown at the bottom of the Balances page & Beanstalk total assets.
 */
import { FC } from '~/types';

export type StatItem = {
  title: string;
  tooltip: string;
  token?: Token;
  amount: BigNumber;
  amountModifier?: BigNumber;
}

const StatsCard: FC<{
  stats: StatItem[];
} & CardProps> = ({ stats }, props) => (
  <Card sx={{ p: 1, borderColor: BeanstalkPalette.lightestGrey }} {...props}>
    <Grid container spacing={1} rowSpacing={3}>
      {stats.map((stat, index) => (
        <Grid key={index} item xs={12} md={3}>
          <Stat
            variant="h4"
            gap={0}
            title={stat.title}
            titleTooltip={stat.tooltip}
            amountIcon={stat.token && <TokenIcon token={stat.token} />}
            amount={(
              <>
                {displayFullBN(stat.amount, stat.token ? stat.token.displayDecimals : 2)}
                {stat.amountModifier !== undefined && (
                  <Typography color="primary" variant="h4">
                    + {displayFullBN(stat.amountModifier, stat.token ? stat.token.displayDecimals : 2)}
                  </Typography>
                )}
              </>
            )}
          />
        </Grid>
      ))}
    </Grid>
  </Card>
);

export default StatsCard;
