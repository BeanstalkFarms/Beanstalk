import React from 'react';
import { Box, Stack, Typography } from '@mui/material';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import { IS_DEV } from '~/util';

import useTemperature from '~/hooks/beanstalk/useTemperature';
import { useAppSelector } from '~/state';
import Row from '../Common/Row';

const Split = ({ children }: { children: React.ReactNode }) => (
  <Row justifyContent="space-between" gap={1}>
    {children}
  </Row>
);

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
            <Split>
              <Typography>SeasonTime:</Typography>
              <Typography>{seasonTime.toString()}</Typography>
            </Split>
            <Split>
              <Typography>Morning Block:</Typography>
              <Typography>{morning.blockNumber.toString()}</Typography>
            </Split>
            <Split>
              <Typography>Sunrise Block:</Typography>
              <Typography>{sunrise.sunriseBlock.toString()}</Typography>
            </Split>
            <Split>
              <Typography>Delta Blocks:</Typography>
              <Typography>{deltaBlocks.toString()}</Typography>
            </Split>
            <Split>
              <Typography>Morning index:</Typography>
              <Typography>{morning.index.toString()}</Typography>
            </Split>
            <Split>
              <Typography>Interval:</Typography>
              <Typography>{morning.index.plus(1).toString()}</Typography>
            </Split>
            <Split>
              <Typography>Scaled Temperature:</Typography>
              <Typography>{temp.scaled.toString()}</Typography>
            </Split>
            <Split>
              <Typography>Calculated temp:</Typography>
              <Typography>{calculatedTempData?.toString()}</Typography>
            </Split>
            <Split>
              <Typography>Max Temperature:</Typography>
              <Typography>{temp.max.toString()}</Typography>
            </Split>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export default FieldOverlay;
