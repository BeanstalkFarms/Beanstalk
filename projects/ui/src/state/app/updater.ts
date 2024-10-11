import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { useHotkeys } from 'react-hotkeys-hook';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import useTimedRefresh from '~/hooks/app/useTimedRefresh';
import useSetting from '~/hooks/app/useSetting';
import useSdk from '~/hooks/sdk';
import { ChainResolver } from '@beanstalk/sdk-core';
import BigNumber from 'bignumber.js';
import { setEthPrices, updateSetting } from './actions';

export const useEthPrices = () => {
  const dispatch = useDispatch();
  const sdk = useSdk();

  const getGas = useCallback(() => {
    (async () => {
      if (!ChainResolver.isL2Chain(sdk.chainId)) {
        return;
      }
      try {
        console.debug('[useEthPrices/fetch] fetching...');
        const query = await fetch('/.netlify/functions/ethprice');

        const [ethprice, ethGasPrice, ethL1BaseFee] = await Promise.all([
          query.json(),
          sdk.provider.getGasPrice(),
          sdk.provider
            .getBlock('latest')
            .then((result) => result.baseFeePerGas),
        ]);

        console.debug('[useEthPrices/fetch] RESULT: ', {
          ethprice,
          ethGasPrice,
          ethL1BaseFee,
        });

        dispatch(
          setEthPrices({
            ...ethprice,
            ethusd: new BigNumber(ethprice?.ethusd || '0'),
            gasPrice: new BigNumber(ethGasPrice?.toString() || '0'),
            baseFeePerGas: new BigNumber(ethL1BaseFee?.toString() || '0'),
          })
        );
      } catch (e) {
        console.error('Failed to load: ethprice');
      }
    })();
  }, [dispatch, sdk]);

  // / Auto-refresh gas prices every 60s.
  // / FIXME: refresh every block or N blocks instead?
  useTimedRefresh(getGas, 60 * 1000);

  return [getGas, () => {}];
};

export default function AppUpdater() {
  const dispatch = useDispatch();
  const [denomination] = useSetting('denomination');
  const navigate = useNavigate();

  useEthPrices();

  useHotkeys(
    'opt+f, alt+f',
    (/* event, handler */) => {
      dispatch(
        updateSetting({
          key: 'denomination',
          value: denomination === 'bdv' ? 'usd' : 'bdv',
        })
      );
      toast.success(
        `Updated setting: Show fiat in ${
          denomination === 'bdv' ? 'USD' : 'BDV'
        }.`
      );
    },
    { keyup: true },
    [denomination]
  );

  useHotkeys(
    'opt+q, alt+q',
    () => {
      navigate('/');
    },
    {},
    [navigate]
  );
  useHotkeys(
    'opt+w, alt+w',
    () => {
      navigate('/silo');
    },
    {},
    [navigate]
  );
  useHotkeys(
    'opt+e, alt+e',
    () => {
      navigate('/field');
    },
    {},
    [navigate]
  );
  useHotkeys(
    'opt+r, alt+r',
    () => {
      navigate('/barn');
    },
    {},
    [navigate]
  );
  useHotkeys(
    'opt+t, alt+t',
    () => {
      navigate('/market');
    },
    {},
    [navigate]
  );
  useHotkeys(
    'opt+a, alt+a',
    () => {
      navigate('/analytics');
    },
    {},
    [navigate]
  );
  useHotkeys(
    'opt+s, alt+s',
    () => {
      navigate('/balances');
    },
    {},
    [navigate]
  );
  useHotkeys(
    'opt+d, alt+d',
    () => {
      navigate('/balances');
    },
    {},
    [navigate]
  );

  return null;
}

// const pressed  = useAppFlag('almanacView');
// useEffect(() => {
//   window.addEventListener('blur', () => {
//     dispatch(setAlmanacView(false));
//   });
// }, [dispatch]);
// useHotkeys('opt+q, alt+q', (/* event, handler */) => {
//   if (!pressed) {
//     dispatch(setAlmanacView(true));
//   }
// }, { keydown: true }, [pressed]);
// useHotkeys('opt+q, alt+q', (/* event, handler */) => {
//   dispatch(setAlmanacView(false));
// }, { keyup: true });
