import { TestUtils } from '@beanstalk/sdk';

import { useMemo, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { SupportedChainId } from '~/constants';

import useSdk from '~/hooks/sdk';
import useChainId from '~/hooks/chain/useChainId';

import { IS_DEV } from '~/util';
import { selectSunriseBlock } from '~/state/beanstalk/sun/reducer';

const FORCE_BLOCK_CONFIG = {
  force: true,
  debug: true,
};

const CAN_FORCE_BLOCK = FORCE_BLOCK_CONFIG.force && IS_DEV;

/// When developing in local host, blocks don't update automatically.
/// IF AND ONLY IF env === DEV && chainID == Localhost we force update the block,
/// every 12 seconds, relative to when sunrise was called
export default function useForceBlockDevOnly() {
  const sdk = useSdk();
  const chainId = useChainId();
  const chainUtil = useMemo(() => new TestUtils.BlockchainUtils(sdk), [sdk]);
  const sunriseTime = useSelector(selectSunriseBlock).timestamp;

  /// Timer for debugging. To set, set FORCE_BLOCK_CONFIG.debug to true
  const [_, setLastTime] = useState(0);

  useEffect(() => {
    if (
      !CAN_FORCE_BLOCK ||
      chainId !== SupportedChainId.LOCALHOST ||
      sunriseTime.lte(0)
    ) {
      return;
    }

    const _sunriseTime = sunriseTime.times(1000).toNumber();

    const intervalId = setInterval(() => {
      const _currentTime = new Date().getTime();
      const secondsDiff = Math.ceil(
        Math.abs(_currentTime - _sunriseTime) / 1000
      );

      console.debug('[useForceBlock][DEV-ONLY]: secondsDiff', secondsDiff);

      /// if it's been less than 1 block since the start of season, return
      if (secondsDiff < 12) return;

      if (secondsDiff % 12 <= 0) {
        chainUtil.forceBlock();
        if (!FORCE_BLOCK_CONFIG.debug) return;
        setLastTime((prev) => {
          if (prev === 0) {
            console.debug(
              '[useForceBlock][DEV-ONLY]: first time, Forcing block update...'
            );
            return _currentTime;
          }
          const diff = Math.abs(prev - _currentTime);
          const elapsed = diff / 1000;
          console.debug(
            `[useForceBlock][DEV-ONLY]`,
            elapsed,
            'seconds have elapsed. Forcing block update...'
          );
          return _currentTime;
        });
      }
    }, 1_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [sunriseTime, chainId, chainUtil]);
}
