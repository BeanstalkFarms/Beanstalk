import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { TestUtils } from '@beanstalk/sdk';
import { Box, Stack, Typography, Button } from '@mui/material';
import { useDispatch } from 'react-redux';
import { DateTime, Settings as LuxonSettings } from 'luxon';
import { useProvider } from 'wagmi';
import BigNumber from 'bignumber.js';
import useSdk from '~/hooks/sdk';
import {
  getNowRounded,
  getMorningResult,
  getDiffNow,
} from '~/state/beanstalk/sun';
import { setMorning } from '~/state/beanstalk/sun/actions';
import { useSun } from '~/state/beanstalk/sun/updater';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import { IS_DEV, tokenResult } from '~/util';

import Row from '~/components/Common/Row';
import useFetchLatestBlock, {
  BlockInfo,
} from '~/hooks/chain/useFetchLatestBlock';
import useTemperature from '~/hooks/beanstalk/useTemperature';
import { useAppSelector } from '~/state';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import { BEAN } from '~/constants/tokens';

const minimize = false;
/**
 * TEMPORARY --> DEV ONLY
 * Used to help faciliate the starting of a new season
 */
const FieldOverlay: React.FC<{}> = () => {
  const sdk = useSdk();
  const provider = useProvider();
  const chainUtil = useMemo(() => new TestUtils.BlockchainUtils(sdk), [sdk]);
  const morning = useAppSelector((s) => s._beanstalk.sun.morning);
  const seasonTime = useAppSelector((s) => s._beanstalk.sun.seasonTime);
  const sunrise = useAppSelector((s) => s._beanstalk.sun.season);
  const temp = useAppSelector((s) => s._beanstalk.field.temperature);
  const morningTime = useAppSelector((s) => s._beanstalk.sun.morningTime);

  const beanstalk = useBeanstalkContract();

  const [fetchSun] = useSun();
  const [fetchBlock] = useFetchLatestBlock();

  const [blockDatas, setBlockDatas] = useState<
    (BlockInfo & {
      rTimestamp: DateTime;
      temp: BigNumber;
      calculated: BigNumber;
      soil: BigNumber;
    })[]
  >([]);

  const [{ current }, { calculate: calculateTemperature }] = useTemperature();

  const calculatedTempData = current.toString();

  const dispatch = useDispatch();

  const setLuxonGlobal = useCallback((from: DateTime) => {
    const diff = getDiffNow(from);
    const millis = diff.as('seconds') * 1000;

    LuxonSettings.now = () => Date.now() + millis;
  }, []);

  const getNow = () => {
    const now = getNowRounded();
    console.log(now.toLocaleString(DateTime.TIME_WITH_SECONDS));
  };

  const handleClick = useCallback(async () => {
    console.log('forwarding season...');
    await chainUtil.sunriseForward();
    console.log('fetching sun...');
    const [s] = await fetchSun();
    const b = await fetchBlock();
    if (!s) return;
    console.log('sun fetched...');
    setLuxonGlobal(s.timestamp);

    const morningResult = getMorningResult({
      timestamp: s.timestamp,
      blockNumber: b.blockNumber,
    });

    console.log('dispaptching updated morning data');
    dispatch(setMorning(morningResult));
    // fetchMorningField();
  }, [chainUtil, dispatch, fetchBlock, fetchSun, setLuxonGlobal]);

  useEffect(() => {
    if (!morning.isMorning) return;
    const subscribe = () => {
      provider.on('block', () => {
        const getInfo = async () => {
          const [_blockData, _temperature, _soil] = await Promise.all([
            fetchBlock(),
            beanstalk.temperature().then(tokenResult(BEAN)),
            beanstalk.totalSoil().then(tokenResult(BEAN)),
          ]);

          const calculated = calculateTemperature(_blockData.blockNumber);
          const scaled = _temperature;
          setBlockDatas((prev) => [
            ...prev,
            {
              blockNumber: _blockData.blockNumber,
              timestamp: _blockData.timestamp,
              rTimestamp: morningTime.next.minus({ seconds: 12 }),
              temp: scaled,
              soil: _soil,
              calculated,
            },
          ]);
        };

        getInfo();
      });

      return () => {
        provider.off('block');
      };
    };

    const unsubscribe = subscribe();

    return () => unsubscribe();
  }, [
    fetchBlock,
    provider,
    morningTime.next,
    morning.isMorning,
    beanstalk,
    calculateTemperature,
  ]);

  const jsonify = () => {
    try {
      const d = blockDatas.map((b) => ({
        sunriseBlock: sunrise.sunriseBlock.toString(),
        blockNumber: b.blockNumber.toString(),
        temp: b.temp.toString(),
        soil: b.soil.toString(),
        calculated: b.calculated.toString(),
      }));
      const json = JSON.stringify(d);
      console.log(json);
    } catch (err) {
      console.log(err);
    }
  };

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
              <Button fullWidth size="small" onClick={getNow}>
                print now
              </Button>
              <Button fullWidth size="small" onClick={jsonify}>
                JSONify
              </Button>
            </Row>
            <Stack gap={0.5} p={2}>
              <Row justifyContent="space-between">
                <Typography>BlockNumber</Typography>
                {/* <Typography>blockTS</Typography> */}
                {/* <Typography>expectedTS</Typography> */}
                <Typography>temp</Typography>
                <Typography>calculated</Typography>
                <Typography>soil</Typography>
              </Row>
              {blockDatas.map((b, i) => (
                <Row justifyContent="space-between" key={i}>
                  <Typography>{b.blockNumber.toString()}</Typography>
                  <Typography>
                    {b.timestamp.toLocaleString(DateTime.TIME_WITH_SECONDS)}
                  </Typography>
                  <Typography>
                    {b.rTimestamp.toLocaleString(DateTime.TIME_WITH_SECONDS)}
                  </Typography>
                  <Typography>{b.temp.toString()}</Typography>
                  <Typography>{b.calculated.toString()}</Typography>
                  <Typography>{b.soil.toString()}</Typography>
                </Row>
              ))}
            </Stack>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
};

export default FieldOverlay;
