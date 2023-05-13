import React, { useMemo, useCallback, useState } from 'react';
import { TestUtils } from '@beanstalk/sdk';
import { Box, Stack, Typography, Button } from '@mui/material';
import { DateTime } from 'luxon';
import { useSelector, useDispatch } from 'react-redux';
import { useProvider } from 'wagmi';
import useSdk from '~/hooks/sdk';
import {
  selectBeanstalkField,
  selectFieldTemperature,
} from '~/state/beanstalk/field/reducer';
import {
  selectMorning,
  selectSunriseBlock,
  getNowRounded,
  getMorningResult,
  getDiffNow,
  getNextExpectedBlockUpdate,
} from '~/state/beanstalk/sun';
import { setMorning, updateSeasonResult } from '~/state/beanstalk/sun/actions';
import { useFetchMorningField } from '~/state/beanstalk/sun/morning';
import { useSun } from '~/state/beanstalk/sun/updater';

import { BeanstalkPalette } from '~/components/App/muiTheme';
import { IS_DEV } from '~/util';

import Row from '~/components/Common/Row';
import useFetchLatestBlock from '~/hooks/chain/useFetchLatestBlock';
import useTemperature from '~/hooks/beanstalk/useTemperature';
import { AppState } from '~/state';

const minimize = false;

/**
 * TEMPORARY --> DEV ONLY
 * Used to help faciliate the starting of a new season
 */
const FieldOverlay: React.FC<{}> = () => {
  const sdk = useSdk();
  const chainUtil = useMemo(() => new TestUtils.BlockchainUtils(sdk), [sdk]);

  const morning = useSelector(selectMorning);
  // const morningBlockMap = useSelector(selectMorningBlockMap);
  const sunrise = useSelector(selectSunriseBlock);
  const temp = useSelector(selectBeanstalkField).temperature;
  const seasonState = useSelector<
    AppState,
    AppState['_beanstalk']['sun']['season']
  >((state) => state._beanstalk.sun.season);

  const temps = useSelector(selectFieldTemperature);

  // console.log('temp - max: ', temps.max.toString());
  // console.log('temp - scaled: ', temps.scaled.toString());

  const [fetchSun] = useSun();
  const [fetchMorningField] = useFetchMorningField();
  const [fetchBlock] = useFetchLatestBlock();

  const [{ current }, { calculate }] = useTemperature();

  const calculatedTempData = current.toString();

  const dispatch = useDispatch();

  const handleForceBlock = useCallback(async () => {
    // await chainUtil.forceBlock();
    // const blockData = await fetchBlock();
    // const newBlockNumber = blockData.blockNumber;

    // const value = morningBlockMap[newBlockNumber.toString()];
    // if (!value) return;
    // console.log('now: ', getNowRounded());
    // console.log('value.rTimestamp', value.rTimestamp.toSeconds());
    const endTime = sunrise.timestamp.plus({ minutes: 5 });
    const sunriseSecs = sunrise.timestamp.toSeconds();
    const now = getNowRounded();
    const nowSecs = now.toSeconds();

    const maxSeconds = endTime.toSeconds() - sunriseSecs;
    const currentSeconds = nowSecs - sunriseSecs;

    console.log('currentSeconds: ', currentSeconds);
    console.log('maxSeconds: ', maxSeconds);

    const diff = nowSecs - sunriseSecs;
    console.log('diff: ', diff);
    // const _mod = diff / 25;
    // console.log('_mod: ', _mod);
    const index = Math.floor(diff / 12);
    console.log('index: ', index);

    const blockNumber = sunrise.blockNumber.plus(index);
    console.log('sunriseblock: ', sunrise.blockNumber.toString());
    console.log('blockNumber: ', blockNumber.toString());

    const curr = sunrise.timestamp.plus({ seconds: index * 12 });

    const next = getNextExpectedBlockUpdate(curr);
    const remaining = getDiffNow(next);

    console.log('next: ', next.toLocaleString(DateTime.TIME_WITH_SECONDS));
    console.log('remaining: ', remaining.as('seconds'));

    // const diff = value.rTimestamp.diff(now).as('seconds');
    // console.log('diff', diff);
    // const updatedMap = updateMorningBlockMap(morningBlockMap, {
    //   blockNumber: newBlockNumber,
    //   seconds: diff,
    // });

    // dispatch(
    //   setMorning({
    //     isMorning: true,
    //     endTime: now.plus({ minutes: 5 }),
    //     // blockMap: updatedMap,
    //     blockNumber: newBlockNumber,
    //   })
    // );
    // fetchMorningField();
  }, [sunrise.blockNumber, sunrise.timestamp]);

  const setSunriseNow = useCallback(async () => {
    const now = getNowRounded();

    const _data = {
      ...seasonState,
      sunriseBlock: sunrise.blockNumber,
      timestamp: now,
    };
    console.log('dispaptching updated morning data');
    dispatch(updateSeasonResult(_data));
  }, [dispatch, seasonState, sunrise.blockNumber]);

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
        ...seasonState,
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
    seasonState,
  ]);
  const [ts, setTs] = useState<any[]>([]);
  const [diffs, setDiffs] = useState<any[]>([]);
  const [chainblock, setchainblock] = useState<number>(-1);
  const provider = useProvider();

  // useEffect(() => {
  //   const subscribe = () => {
  //     provider.on('block', (b) => {
  //       setchainblock(b);
  //       const d = async () => {
  //         const blk = await provider.getBlock('latest');
  //         const blockNumber = new BigNumber(blk.number);
  //         const curr = DateTime.fromSeconds(blk.timestamp);
  //         const next = curr.plus({ seconds: 12 });
  //         console.log('***** blockNumber: ', blk.number);
  //         console.log('***** blockts: ', curr.toSeconds());
  //         console.log('***** nextts: ', next.toSeconds());
  //         const t = await sdk.contracts.beanstalk
  //           .temperature()
  //           .then(tokenResult(BEAN));

  //         const calculated = calculate(blockNumber);

  //         if (!t.eq(calculated)) {
  //           const dasdf = {
  //             blockNumber: blockNumber.toNumber(),
  //             chain: t.toNumber(),
  //             calculated: calculated.toNumber(),
  //           };
  //           setTs((prev) => [...prev, t.toNumber()]);
  //           console.log('diff: ', dasdf);

  //           setDiffs((prev) => [...prev, dasdf]);
  //         }
  //       };
  //       d();
  //     });

  //     return () => {
  //       provider.off('block');
  //     };
  //   };

  //   const unsubsribe = subscribe();

  //   return () => unsubsribe();
  // }, [calculate, current, provider, sdk.contracts.beanstalk, temps.scaled]);

  // useEffect(() => {
  //   if (!morning.isMorning) {
  //     console.log(JSON.stringify(ts));
  //   }
  // }, [diffs, morning.isMorning, ts]);

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
            <p>
              sr time:{' '}
              {DateTime.fromSeconds(1683309659).toLocaleString(
                DateTime.TIME_WITH_SECONDS
              )}
            </p>
            <p>chain block: {chainblock}</p>
            <Typography>
              Current Block: {morning.blockNumber.toString()}
            </Typography>
            <Typography>
              Sunrise Block: {sunrise.blockNumber.toString()}
            </Typography>
            <Typography>Interval: {morning.interval.toString()}</Typography>
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
              <Button fullWidth size="small" onClick={handleForceBlock}>
                Force block
              </Button>
              <Button fullWidth size="small" onClick={setSunriseNow}>
                Set Sunrise
              </Button>
            </Row>
          </Stack>
          {/* <Box>
            <Row gap={2} justifyContent="space-between">
              <Stack
                alignSelf="flex-end"
                px={2}
                sx={{ width: '100%', maxWidth: '400px', maxHeight: '500px' }}
              >
                <Typography variant="h4" sx={{ pb: 1 }}>
                  morning block map
                </Typography>
                <Box sx={{ overflow: 'auto' }}>
                  <Stack gap={1} py={1}>
                    {Object.entries(morningBlockMap).map(([k, v]) => {
                      const {
                        blockNumber,
                        timestamp,
                        next,
                        rNext,
                        rTimestamp,
                      } = v;
                      return (
                        <Stack gap={0.5} key={k}>
                          <Typography variant="h4">
                            Interval:{' '}
                            {blockNumber
                              .minus(sunrise.blockNumber)
                              .plus(1)
                              .toString()}
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
                            <InfoRow label="rTimestamp">
                              <Typography>
                                {rTimestamp.toLocaleString(
                                  DateTime.TIME_WITH_SECONDS
                                )}
                              </Typography>
                            </InfoRow>
                            <InfoRow label="next: ">
                              <Typography>
                                {next.toLocaleString(
                                  DateTime.TIME_WITH_SECONDS
                                )}
                              </Typography>
                            </InfoRow>
                            <InfoRow label="rNext">
                              <Typography>
                                {rNext.toLocaleString(
                                  DateTime.TIME_WITH_SECONDS
                                )}
                              </Typography>
                            </InfoRow>
                          </Stack>
                        </Stack>
                      );
                    })}
                  </Stack>
                </Box>
              </Stack>
            </Row>
          </Box> */}
        </Box>
      </Box>
    </Box>
  );
};

export default FieldOverlay;
