import React, { useMemo } from 'react';
import { ButtonProps, Button } from '@mui/material';
import { useDispatch } from 'react-redux';
import { TestUtils } from '@beanstalk/sdk';
import { Settings as LuxonSettings } from 'luxon';
import { SupportedChainId } from '~/constants';

import { FC } from '~/types';
import useSdk from '~/hooks/sdk';
import useFetchLatestBlock from '~/hooks/chain/useFetchLatestBlock';
import { useSun } from '~/state/beanstalk/sun/updater';
import { getDiffNow, getMorningResult } from '~/state/beanstalk/sun';

import { setMorning } from '~/state/beanstalk/sun/actions';
import useChainId from '~/hooks/chain/useChainId';
import useToggle from '~/hooks/display/useToggle';

/**
 * Forcibly Forwards the season
 *
 * NOTE: This is only available in DEV env & when chainId is 1337.
 * This will work ONLY IF VITE_OVERRIDE_FARMER_ACCOUNT is set in your .env.local
 *
 */

const SunButtonDev: FC<ButtonProps> = (props) => {
  const sdk = useSdk();
  const [isLoading, setTrue, setFalse] = useToggle();

  const chainUtil = useMemo(() => new TestUtils.BlockchainUtils(sdk), [sdk]);

  const [fetchSun] = useSun();
  const [fetchBlock] = useFetchLatestBlock();

  const dispatch = useDispatch();

  const chainID = useChainId();

  if (!import.meta.env.DEV || chainID !== SupportedChainId.LOCALHOST) {
    return null;
  }

  const handleSunriseForward = async () => {
    setTrue();
    console.debug('Forwarding Season...');
    await chainUtil.sunriseForward();
    const [s] = await fetchSun();
    const b = await fetchBlock();

    if (!s) {
      console.error('failed to fetch sun');
      setFalse();
      return;
    }

    const diff = getDiffNow(s.timestamp);
    const mills = diff.as('seconds') * 1000;

    // set global luxon - time settings
    LuxonSettings.now = () => Date.now() + mills;

    const morningResult = getMorningResult({
      timestamp: s.timestamp,
      blockNumber: b.blockNumber,
    });

    dispatch(setMorning(morningResult));

    console.debug('Season forward success!');
    setFalse();
  };

  return (
    <Button
      fullWidth
      disabled={isLoading}
      onClick={handleSunriseForward}
      {...props}
      sx={{ mt: 1, ...props.sx }}
    >
      {isLoading ? 'Loading...' : 'Force Sunrise'}
    </Button>
  );
};

export default SunButtonDev;
