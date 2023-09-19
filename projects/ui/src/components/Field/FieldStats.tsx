import React from 'react';
import { Grid, Typography } from '@mui/material';

import { BeanstalkField } from '~/state/beanstalk/field';
import { displayFullBN } from '~/util';

import Stat from '~/components/Common/Stat';

const FieldStats: React.FC<{ beanstalkField: BeanstalkField }> = ({
  beanstalkField,
}) => (
  <Grid container spacing={2}>
    <Grid item xs={12} md={6}>
      <Stat
        gap={0}
        title="Soil"
        amount={displayFullBN(beanstalkField.soil, 0)}
        subtitle={
          <Typography color="text.secondary">
            The number of Beans that Beanstalk currently is willing to borrow.
          </Typography>
        }
      />
    </Grid>
    <Grid item xs={12} md={6}>
      <Stat
        gap={0}
        title="Pod Line"
        amount={displayFullBN(beanstalkField.podLine, 0)}
        subtitle={
          <Typography color="text.secondary">
            The total number of outstanding Pods.
          </Typography>
        }
      />
    </Grid>
  </Grid>
);

export default FieldStats;
