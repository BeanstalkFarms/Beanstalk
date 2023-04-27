import React, { useMemo, useCallback } from 'react';
import { TestUtils } from '@beanstalk/sdk';
import { Box, Stack, Typography, Button } from '@mui/material';
import { DateTime } from 'luxon';
import { useSelector, useDispatch } from 'react-redux';
import useMorningTemperature from '~/hooks/beanstalk/useMorningTemperature';
import useSdk from '~/hooks/sdk';
import { selectBeanstalkField } from '~/state/beanstalk/field/reducer';
import {
  selectMorning,
  selectSunriseBlock,
  initMorningBlockMap,
  selectCurrentSeason,
} from '~/state/beanstalk/sun';
import { setMorning, updateMorningBlock } from '~/state/beanstalk/sun/actions';
import { useSun } from '~/state/beanstalk/sun/updater';
import { BeanstalkPalette } from '../App/muiTheme';
import { useFetchMorningField } from '~/state/beanstalk/sun/morning';

const minimize = false;

/**
 * TEMORARY
 * Used to help faciliate the starting of a new season
 */
const FieldOverlay: React.FC<{}> = () => {
  const sdk = useSdk();
  const chainUtil = useMemo(() => new TestUtils.BlockchainUtils(sdk), [sdk]);

  const morning = useSelector(selectMorning);
  const sunrise = useSelector(selectSunriseBlock);
  const temp = useSelector(selectBeanstalkField).temperature;

  const [fetchSun] = useSun();
  const [fetchMorningField] = useFetchMorningField();

  const { temperatureMap } = useMorningTemperature();
  const calculatedTempData = temperatureMap[morning.interval.toNumber()];

  const dispatch = useDispatch();

  const handleForceBlock = useCallback(async () => {
    await chainUtil.forceBlock();
    dispatch(updateMorningBlock(morning.blockNumber.plus(1)));
    fetchMorningField();
  }, [chainUtil, dispatch, fetchMorningField, morning.blockNumber]);

  const handleClick = useCallback(async () => {
    await chainUtil.sunriseForward();
    const nowSeconds = Math.ceil(DateTime.now().toSeconds());
    const [s] = await fetchSun();
    await fetchMorningField();
    if (!s) return;
    const sunriseTimestampSeconds = s.timestamp.toSeconds();
    const secondsDiff = sunriseTimestampSeconds - nowSeconds;

    const morningMap = initMorningBlockMap({
      sunriseBlock: s.sunriseBlock,
      timestamp: s.timestamp,
      offset: {
        seconds: secondsDiff,
        block: s.sunriseBlock,
      },
    });
    dispatch(
      setMorning({
        blockMap: morningMap,
        blockNumber: s.sunriseBlock,
      })
    );
  }, [chainUtil, dispatch, fetchMorningField, fetchSun]);

  if (minimize) return null;

  return (
    <Box
      position="absolute"
      bottom="20px"
      right="20px"
      zIndex={99}
      sx={{ background: BeanstalkPalette.mediumGreen }}
    >
      <Box position="relative">
        <Box sx={{ minWidth: '250px' }}>
          <Stack gap={1} p={2}>
            <Typography>
              Current Block: {morning.blockNumber.toString()}
            </Typography>
            <Typography>Sunrise Block: {sunrise.block.toString()}</Typography>
            <Typography>Interval: {morning.interval.toString()}</Typography>
            <Typography>
              temp from contract: {temp.scaled.toString()}
            </Typography>
            <Typography>
              calculated temp: {calculatedTempData?.temperature.toString()}
            </Typography>
            <Typography>max temp: {temp.max.toString()}</Typography>
            <Button onClick={handleClick}>call sunrise</Button>
            <Button onClick={handleForceBlock}>Force block</Button>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export default FieldOverlay;

export const FieldTester2: React.FC<{}> = () => {
  const select = useSelector(selectCurrentSeason);

  console.log('selectMorningBlock2222 rerender...');

  return <Box>{JSON.stringify(select)}</Box>;
};

export const FieldTester: React.FC<{}> = () => {
  const select = useSelector(selectCurrentSeason);

  console.log('selectMorningBlock rerender...');

  return <Box>{JSON.stringify(select)}</Box>;
};
