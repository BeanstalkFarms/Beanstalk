import { TestUtils } from '@beanstalk/sdk';
import { Box, Button, Stack, Typography } from '@mui/material';
import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import useSdk from '~/hooks/sdk';
import { selectMorning, selectSunriseBlock } from '.';
import { useSun } from './updater';
import { BeanstalkPalette } from '~/components/App/muiTheme';
import { useFetchTemperature } from '../field/updater';
import useMorningTemperature from '~/hooks/beanstalk/useMorningTemperature';
import { selectBeanstalkField } from '../field/reducer';

/**
 * TEMPORARY COMPONENT
 */

const BlockUpdaterOverlay: React.FC<{}> = () => {
  const sdk = useSdk();
  const chainUtil = useMemo(() => new TestUtils.BlockchainUtils(sdk), [sdk]);
  const morning = useSelector(selectMorning);
  const sunrise = useSelector(selectSunriseBlock);
  const [fetch] = useSun();
  const [temp, _] = useFetchTemperature();
  const maxTemp = useSelector(selectBeanstalkField).temperature.max;

  const { temperatureMap } = useMorningTemperature();

  const calculatedTempData = temperatureMap[morning.interval.toNumber()];

  const minimize = false;

  if (minimize) return null;

  return (
    <Box
      sx={{
        position: 'absolute',
        right: '20px',
        bottom: '20px',
        zIndex: 99,
        background: BeanstalkPalette.mediumGreen,
      }}
    >
      <Box sx={{ minWidth: '250px' }}>
        <Stack gap={1} p={2}>
          <Typography>
            Current Block: {morning.blockNumber.toString()}
          </Typography>
          <Typography>Sunrise Block: {sunrise.block.toString()}</Typography>
          <Typography>Interval: {morning.interval.toString()}</Typography>
          <Typography>temp from contract: {temp.toString()}</Typography>
          <Typography>
            calculated temp: {calculatedTempData?.temperature.toString()}
          </Typography>
          <Typography>max temp: {maxTemp.toString()}</Typography>
          <Button
            onClick={() => {
              chainUtil.forceBlock();
            }}
          >
            force block
          </Button>
          <Button
            onClick={async () => {
              console.log('prev season');
              await chainUtil.sunriseForward();
              const [s] = await fetch();
              console.log('new season', s?.current);
            }}
          >
            call sunrise
          </Button>
        </Stack>
      </Box>
    </Box>
  );
};

export default BlockUpdaterOverlay;
