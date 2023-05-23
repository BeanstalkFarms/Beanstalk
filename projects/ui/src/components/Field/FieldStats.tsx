import React, { useEffect, useState } from 'react';
import { Grid, Stack, Typography } from '@mui/material';

import BigNumber from 'bignumber.js';
import { displayFullBN, normalizeBN } from '~/util';

import Stat from '~/components/Common/Stat';
import { useAppSelector } from '~/state';
import useSoil from '~/hooks/beanstalk/useSoil';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { ZERO_BN } from '~/constants';
import FieldBlockCountdown from './FieldBlockCountdown';

const FieldStats: React.FC<{}> = () => {
  const podLine = useAppSelector((s) => s._beanstalk.field.podLine);
  const [fieldSoil] = useSoil();

  const soil = fieldSoil.soil;
  const nextSoil = fieldSoil.nextSoil;

  console.log('soil: ', soil.toNumber());
  console.log('nextSoil: ', nextSoil.toNumber());

  const blockDeltaSoil = nextSoil.minus(soil);
  console.log('blockDeltaSoil: ', blockDeltaSoil.toNumber());

  const [soils, setSoil] = useState<BigNumber[]>([]);

  useEffect(() => {
    const last = soils[soils.length - 1] || ZERO_BN;

    if (!last.eq(soil) && soil.gt(0)) {
      setSoil((prev) => [...prev, soil]);
    }
  }, [soil, soils]);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <Stat
          gap={0}
          title="Soil"
          amount={
            <Typography
              variant="inherit"
              sx={{ display: 'inline-flex', alignItems: 'center' }}
            >
              {displayFullBN(normalizeBN(soil), 0)}
              {!nextSoil.eq(soil) && (
                <Typography
                  component="span"
                  sx={{
                    color: BeanstalkPalette.trueRed,
                    ml: 0.5,
                  }}
                >
                  {displayFullBN(blockDeltaSoil, 0)} in <FieldBlockCountdown />
                </Typography>
              )}
            </Typography>
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
      <Grid item>
        <Stack gap={0}>
          {soils.map((s, i) => (
            <Typography key={i} variant="caption" color="text.secondary">
              {displayFullBN(s, 0)}
            </Typography>
          ))}
        </Stack>
      </Grid>
    </Grid>
  );
};
export default FieldStats;
