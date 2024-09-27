import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import { IS_DEV } from '~/util';

import useTemperature from '~/hooks/beanstalk/useTemperature';
import { useAppSelector } from '~/state';

const minimize = false;
/**
 * TEMPORARY --> DEV ONLY
 * Used to help faciliate the starting of a new season
 */
const FieldOverlay: React.FC<{}> = () => {
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);
  const seasonTime = useAppSelector((s) => s._beanstalk.sun.seasonTime);
  const sunrise = useAppSelector((s) => s._beanstalk.sun.season);
  const temp = useAppSelector((s) => s._beanstalk.field.temperature);

  const [{ current }] = useTemperature();

  const calculatedTempData = current.toString();

  if (minimize) return null;
  if (!IS_DEV) return null;

  const deltaBlocks = morning.blockNumber.minus(sunrise.sunriseBlock);

  return (
    <Box
      position="absolute"
      bottom="20px"
      right="20px"
      zIndex={99}
      sx={{ background: BeanstalkPalette.mediumGreen }}
    >
      <Box>
        <Box sx={{ width: '400px' }}>
          <Stack gap={0.5} p={2}>
            <Typography>
              Current Block: {morning.blockNumber.toString()}
            </Typography>
            <Typography>
              Sunrise Block: {sunrise.sunriseBlock.toString()}
            </Typography>
            <Typography>Delta Blocks: {deltaBlocks.toString()}</Typography>
            <Typography>SunriseTime: {seasonTime.toString()}</Typography>
            <Typography>
              Interval: {morning.index.plus(1).toString()}
            </Typography>
            <Typography>temp from storage: {temp.scaled.toString()}</Typography>
            <Typography>
              calculated temp: {calculatedTempData?.toString()}
            </Typography>
            <Typography>max temp: {temp.max.toString()}</Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export default FieldOverlay;
