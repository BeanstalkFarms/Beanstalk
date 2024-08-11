import BigNumber from 'bignumber.js';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import LegacyToken from '~/classes/Token';
import { Token } from '@beanstalk/sdk';
import usePrice from '~/hooks/beanstalk/usePrice';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import {
  BEAN,
  UNRIPE_BEAN,
  UNRIPE_BEAN_WSTETH,
  BEAN_WSTETH_WELL_LP,
} from '~/constants/tokens';
import { ZERO_BN } from '~/constants';
import { AppState } from '~/state';
import { Settings } from '~/state/app';

/**
 * FIXME: this function is being called very frequently
 */
const useSiloTokenToFiat = () => {
  ///
  const getChainToken = useGetChainToken();
  const Bean = getChainToken(BEAN);
  const beanWstETH = getChainToken(BEAN_WSTETH_WELL_LP);
  const urBean = getChainToken(UNRIPE_BEAN);
  const urBeanWstETH = getChainToken(UNRIPE_BEAN_WSTETH);

  ///
  const beanPools = useSelector<AppState, AppState['_bean']['pools']>(
    (state) => state._bean.pools
  );
  const unripe = useSelector<AppState, AppState['_bean']['unripe']>(
    (state) => state._bean.unripe
  );
  const price = usePrice();

  return useCallback(
    (
      _token: Token | LegacyToken,
      _amount: BigNumber,
      _denomination: Settings['denomination'] = 'usd',
      _chop: boolean = true
    ) => {
      if (!_amount) return ZERO_BN;

      /// For Beans, use the aggregate Bean price.
      if (_token.address.toLowerCase() === Bean.address.toLowerCase()) {
        return _denomination === 'bdv' ? _amount : _amount.times(price);
      }

      /// For Unripe assets
      if (_token.address.toLowerCase() === urBean.address.toLowerCase()) {
        const choppedBeans = _chop
          ? _amount.times(unripe[urBean.address]?.chopRate || ZERO_BN)
          : _amount;
        return _denomination === 'bdv'
          ? choppedBeans
          : choppedBeans.times(price);
      }

      /// For everything else, use the value of the LP token via the beanPool liquidity/supply ratio.
      /// FIXME: the price contract provides this directly now to save a calculation on the frontend.

      const _poolAddress = _token.address;
      const _amountLP = _amount;

      if (_token.address.toLowerCase() === urBeanWstETH.address.toLowerCase()) {
        // formula for calculating chopped urBEANWstETH LP:
        // amount * penalty (where penalty is amount of beanWstETH for 1 urBeanWstETH)
        const penalty = unripe[urBeanWstETH.address].penalty;
        const choppedLP = _amount.times(penalty);

        const lpUsd = beanPools[beanWstETH.address]?.lpUsd || ZERO_BN;
        const lpBdv = beanPools[beanWstETH.address]?.lpBdv || ZERO_BN;

        return _denomination === 'bdv'
          ? lpBdv?.multipliedBy(_chop ? choppedLP : _amount)
          : lpUsd?.multipliedBy(_chop ? choppedLP : _amount);
      }

      /// Grab pool data. Here we can only have ripe, LP assets (BEAN:3CRV or BEAN:ETH)
      const pool = beanPools[_poolAddress];
      if (!pool || !pool?.liquidity || !pool?.supply) return ZERO_BN;

      const usd = _amountLP?.multipliedBy(pool.lpUsd);
      const bdv = _amountLP?.multipliedBy(pool.lpBdv);

      return _denomination === 'bdv' ? bdv : usd;
    },
    [Bean, beanPools, beanWstETH, price, unripe, urBean, urBeanWstETH]
  );
};

export default useSiloTokenToFiat;
