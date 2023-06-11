import React, { useMemo, useCallback } from 'react';
import { TestUtils } from '@beanstalk/sdk';
import { Box, Stack, Typography, Button } from '@mui/material';
import { useDispatch } from 'react-redux';
import { DateTime, Settings as LuxonSettings } from 'luxon';
import useSdk from '~/hooks/sdk';
import { getMorningResult, getDiffNow } from '~/state/beanstalk/sun';
import { setMorning } from '~/state/beanstalk/sun/actions';
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
  const seasonTime = useAppSelector((s) => s._beanstalk.sun.seasonTime);
  const sunrise = useAppSelector((s) => s._beanstalk.sun.season);
  const temp = useAppSelector((s) => s._beanstalk.field.temperature);

  const [fetchSun] = useSun();
  const [fetchBlock] = useFetchLatestBlock();

  const [{ current }] = useTemperature();

  const calculatedTempData = current.toString();

  const dispatch = useDispatch();

  const setLuxonGlobal = useCallback((from: DateTime) => {
    const diff = getDiffNow(from);
    const millis = diff.as('seconds') * 1000;

    LuxonSettings.now = () => Date.now() + millis;
  }, []);

  const handleClick = useCallback(async () => {
    console.debug('forwarding season...');
    await chainUtil.sunriseForward();
    console.debug('fetching sun...');
    const [s] = await fetchSun();
    const b = await fetchBlock();
    if (!s) return;
    console.debug('sun fetched...');
    setLuxonGlobal(s.timestamp);

    const morningResult = getMorningResult({
      timestamp: s.timestamp,
      blockNumber: b.blockNumber,
    });
    dispatch(setMorning(morningResult));
    // fetchMorningField();
  }, [chainUtil, dispatch, fetchBlock, fetchSun, setLuxonGlobal]);

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
        <Box sx={{ width: '800px' }}>
          <Stack gap={0.5} p={2}>
            <Typography>
              Current Block: {morning.blockNumber.toString()}
            </Typography>
            <Typography>SunriseTime: {seasonTime.toString()}</Typography>
            <Typography>
              Sunrise Block: {sunrise.sunriseBlock.toString()}
            </Typography>
            <Typography>
              Interval: {morning.index.plus(1).toString()}
            </Typography>
            <Typography>temp from storage: {temp.scaled.toString()}</Typography>
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
