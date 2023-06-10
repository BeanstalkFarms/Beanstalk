import React, { useMemo, useCallback } from 'react';
import { TestUtils } from '@beanstalk/sdk';
import { Box, Stack, Typography, Button } from '@mui/material';
import { DateTime } from 'luxon';
import { useSelector, useDispatch } from 'react-redux';
import useSdk from '~/hooks/sdk';
import { selectBeanstalkField } from '~/state/beanstalk/field/reducer';
import {
  selectMorning,
  selectSunriseBlock,
  initMorningBlockMap,
  selectMorningBlockMap,
  MorningBlockMap,
  getDiffNow,
} from '~/state/beanstalk/sun';
import { setMorning } from '~/state/beanstalk/sun/actions';
import { useFetchMorningField } from '~/state/beanstalk/sun/morning';
import { useSun } from '~/state/beanstalk/sun/updater';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import { IS_DEV } from '~/util';

import InfoRow from '~/components/Common/Form/InfoRow';
import Row from '~/components/Common/Row';
import useFetchLatestBlock from '~/hooks/chain/useFetchLatestBlock';
import useMorningTemperature from '~/hooks/beanstalk/useMorningTemperature';

const minimize = false;

/**
 * TEMPORARY --> DEV ONLY
 * Used to help faciliate the starting of a new season
 */
const FieldOverlay: React.FC<{}> = () => {
  const sdk = useSdk();
  const chainUtil = useMemo(() => new TestUtils.BlockchainUtils(sdk), [sdk]);

  const morning = useSelector(selectMorning);
  const morningBlockMap = useSelector(selectMorningBlockMap);
  const sunrise = useSelector(selectSunriseBlock);
  const temp = useSelector(selectBeanstalkField).temperature;

  const [fetchSun] = useSun();
  const [fetchMorningField] = useFetchMorningField();
  const [fetchBlock] = useFetchLatestBlock();

  const temperatureMap = useMorningTemperature();
  const calculatedTempData = temperatureMap[morning.blockNumber.toString()];

  const dispatch = useDispatch();

  const handleForceBlock = useCallback(async () => {
    await chainUtil.forceBlock();
    // const now = getNowRounded();
    const blockData = await fetchBlock();
    const diffnow = getDiffNow(blockData.timestamp);
    const newBlockNumber = blockData.blockNumber;
    const map = { ...morningBlockMap };
    const updatedMap = Object.entries(map).reduce<MorningBlockMap>(
      (prev, [_block, data]) => {
        const blockDiff = data.blockNumber.minus(newBlockNumber);
        if (blockDiff.lt(0)) {
          prev[_block] = data;
          return prev;
        }
        const sunriseTime = sunrise.timestamp;
        const _offset =
          getDiffNow(sunriseTime).as('seconds') -
          blockDiff.times(12).toNumber();

        const offset = blockDiff.times(12).toNumber();
        const offsetSeconds = offset - diffnow.as('seconds');

        prev[_block] = {
          ...data,
          timestamp: blockData.timestamp.plus({ seconds: offsetSeconds }),
          next: blockData.timestamp.plus({ seconds: offsetSeconds + 12 }),
          offset: _offset,
        };
        return prev;
      },
      {}
    );

    dispatch(
      setMorning({
        blockMap: updatedMap,
        blockNumber: morning.blockNumber,
      })
    );
    fetchMorningField();
  }, [
    chainUtil,
    dispatch,
    fetchBlock,
    fetchMorningField,
    morning.blockNumber,
    morningBlockMap,
    sunrise.timestamp,
  ]);

  const handleClick = useCallback(async () => {
    await chainUtil.sunriseForward();
    const [s] = await fetchSun();
    if (!s) return;
    const secondsDiff = getDiffNow(s.timestamp);
    const morningMap = initMorningBlockMap({
      sunriseBlock: s.sunriseBlock,
      timestamp: s.timestamp,
      offset: {
        seconds: secondsDiff.as('seconds'),
        block: s.sunriseBlock,
      },
    });
    dispatch(
      setMorning({
        blockMap: morningMap,
        blockNumber: s.sunriseBlock,
      })
    );
  }, [chainUtil, dispatch, fetchSun]);

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
        <Box sx={{ width: '300px' }}>
          <Stack gap={0.5} p={2}>
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
            <Row gap={1} width="100%" justifyContent="space-between">
              <Button fullWidth size="small" onClick={handleClick}>
                call sunrise
              </Button>
              <Button fullWidth size="small" onClick={handleForceBlock}>
                Force block
              </Button>
            </Row>
          </Stack>
          <Box>
            <Stack px={2} sx={{ maxHeight: '500px' }}>
              <Typography variant="h4" sx={{ pb: 1 }}>
                morning block map
              </Typography>
              <Box sx={{ overflow: 'auto' }}>
                <Stack gap={1} py={1}>
                  {Object.entries(morningBlockMap).map(([k, v]) => {
                    const { blockNumber, timestamp, next, offset } = v;
                    return (
                      <Stack gap={0.5} key={k}>
                        <Typography variant="h4">
                          Interval:{' '}
                          {blockNumber.minus(sunrise.block).plus(1).toString()}
                        </Typography>
                        <Stack px={2}>
                          <InfoRow label="BlockNumber: ">
                            <Typography>{blockNumber.toString()}</Typography>
                          </InfoRow>
                          <InfoRow label="timestamp: ">
                            <Typography>
                              {timestamp.toLocaleString(
                                DateTime.TIME_WITH_SECONDS
                              )}
                            </Typography>
                          </InfoRow>
                          <InfoRow label="next: ">
                            <Typography>
                              {next.toLocaleString(DateTime.TIME_WITH_SECONDS)}
                            </Typography>
                          </InfoRow>
                          <InfoRow label="offset">
                            <Typography>{offset?.toString() || ''}</Typography>
                          </InfoRow>
                        </Stack>
                      </Stack>
                    );
                  })}
                </Stack>
              </Box>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default FieldOverlay;
