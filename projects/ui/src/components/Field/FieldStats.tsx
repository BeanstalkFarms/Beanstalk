import React from 'react';
import { Grid, Typography } from '@mui/material';

import { displayFullBN, normalizeBN } from '~/util';

import Stat from '~/components/Common/Stat';
import { useAppSelector } from '~/state';
import useSoil from '~/hooks/beanstalk/useSoil';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import FieldBlockCountdown from '~/components/Field/FieldBlockCountdown';
import Row from '../Common/Row';

const FieldStats: React.FC<{}> = () => {
  const isMorning = useAppSelector((s) => s._beanstalk.sun.morning.isMorning);
  const podLine = useAppSelector((s) => s._beanstalk.field.podLine);
  const [fieldSoil] = useSoil();

  const soil = fieldSoil.soil;
  const nextSoil = fieldSoil.nextSoil;

  const blockDeltaSoil = nextSoil.minus(soil);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Stat
          gap={0}
          title="Soil"
          amount={
            <Row gap={0.5}>
              <Typography variant="inherit">
                {displayFullBN(normalizeBN(soil), 0)}
              </Typography>
              <Typography component="span" color="text.secondary">
                {isMorning && !nextSoil.eq(soil) && (
                  <>
                    (
                    <Typography
                      component="span"
                      sx={{ color: `${BeanstalkPalette.trueRed} !important` }}
                    >
                      {displayFullBN(blockDeltaSoil, 0)} in{' '}
                      <FieldBlockCountdown />
                    </Typography>
                    )
                  </>
                )}
              </Typography>
            </Row>
          }
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
          amount={displayFullBN(normalizeBN(podLine), 0)}
          subtitle={
            <Typography color="text.secondary">
              The total number of outstanding Pods.
            </Typography>
          }
        />
      </Grid>
    </Grid>
  );
};
export default FieldStats;
