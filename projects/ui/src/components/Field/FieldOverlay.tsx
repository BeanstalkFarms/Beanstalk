import React, { useMemo, useCallback } from 'react';
import { TestUtils } from '@beanstalk/sdk';
import { Box, Stack, Typography, Button } from '@mui/material';
import { useSelector, useDispatch } from 'react-redux';
import useSdk from '~/hooks/sdk';
import { selectBeanstalkField } from '~/state/beanstalk/field/reducer';
import { getNowRounded, getMorningResult } from '~/state/beanstalk/sun';
import { setMorning, updateSeasonResult } from '~/state/beanstalk/sun/actions';
import { useSun } from '~/state/beanstalk/sun/updater';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import { IS_DEV } from '~/util';

import Row from '~/components/Common/Row';
import useFetchLatestBlock from '~/hooks/chain/useFetchLatestBlock';
import useTemperature from '~/hooks/beanstalk/useTemperature';
import { useAppSelector } from '~/state';

const minimize = false;

/**
 * TEMPORARY --> DEV ONLY
 * Used to help faciliate the starting of a new season
 */
const FieldOverlay: React.FC<{}> = () => {
  const sdk = useSdk();
  const chainUtil = useMemo(() => new TestUtils.BlockchainUtils(sdk), [sdk]);
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);

  // const morningBlockMap = useSelector(selectMorningBlockMap);
  const sunrise = useAppSelector((s) => s._beanstalk.sun.season);
  const temp = useSelector(selectBeanstalkField).temperature;

  const [fetchSun] = useSun();
  const [fetchBlock] = useFetchLatestBlock();

  const [{ current }] = useTemperature();

  const calculatedTempData = current.toString();

  const dispatch = useDispatch();

  const handleClick = useCallback(async () => {
    console.log('forwarding season...');
    await chainUtil.sunriseForward();
    console.log('fetching sun...');
    const [s] = await fetchSun();
    const b = await fetchBlock();
    if (!s) return;
    console.log('sun fetched...');
    const now = getNowRounded();

    const morningResult = getMorningResult({
      timestamp: now,
      blockNumber: b.blockNumber,
    });

    console.log('dispaptching updated morning data');
    dispatch(
      updateSeasonResult({
        ...sunrise,
        sunriseBlock: s.sunriseBlock,
        timestamp: now,
      })
    );
    dispatch(setMorning(morningResult));
    // fetchMorningField();
  }, [
    chainUtil,
    dispatch,
    // fetchMorningField,
    fetchBlock,
    fetchSun,
    sunrise,
  ]);
  if (minimize) return null;
  if (!IS_DEV) return null;

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
            <Typography>
              Interval: {morning.index.plus(1).toString()}
            </Typography>
            <Typography>
              temp from contract: {temp.scaled.toString()}
            </Typography>
            <Typography>
              calculated temp: {calculatedTempData?.toString()}
            </Typography>
            <Typography>max temp: {temp.max.toString()}</Typography>
            <Row gap={1} width="100%" justifyContent="space-between">
              <Button fullWidth size="small" onClick={handleClick}>
                call sunrise
              </Button>
            </Row>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export default FieldOverlay;
