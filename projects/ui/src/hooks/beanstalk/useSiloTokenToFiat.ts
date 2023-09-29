import BigNumber from 'bignumber.js';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import Token from '~/classes/Token';
import usePrice from '~/hooks/beanstalk/usePrice';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import {
  BEAN,
  UNRIPE_BEAN,
  BEAN_ETH_WELL_LP,
  UNRIPE_BEAN_WETH,
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
  const urBean = getChainToken(UNRIPE_BEAN);
  const beanWeth = getChainToken(BEAN_ETH_WELL_LP);
  const urBeanWeth = getChainToken(UNRIPE_BEAN_WETH);

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
      _token: Token,
      _amount: BigNumber,
      _denomination: Settings['denomination'] = 'usd',
      _chop: boolean = true
    ) => {
      if (!_amount) return ZERO_BN;

      /// For Beans, use the aggregate Bean price.
      if (_token === Bean) {
        return _denomination === 'bdv' ? _amount : _amount.times(price);
      }

      /// For Unripe assets
      if (_token === urBean) {
        const choppedBeans = _chop
          ? _amount.times(unripe[urBean.address]?.chopRate || ZERO_BN)
          : _amount;
        return _denomination === 'bdv'
          ? choppedBeans
          : choppedBeans.times(price);
      }

      /// For everything else, use the value of the LP token via the beanPool liquidity/supply ratio.
      /// FIXME: the price contract provides this directly now to save a calculation on the frontend.
      let _poolAddress = _token.address;
      let _amountLP = _amount;

      // TODOALEX
      if (_token === urBeanWeth) {
        _poolAddress = beanWeth.address;
        _amountLP = _chop
          ? _amount.times(unripe[urBeanWeth.address]?.chopRate || ZERO_BN)
          : _amount;
      }

      /// Grab pool data
      const pool = beanPools[_poolAddress];
      if (!pool || !pool?.liquidity || !pool?.supply) return ZERO_BN;

      const usd = _amountLP
        .multipliedBy(pool.lpUsd)
        .multipliedBy(unripe[urBeanWeth.address]?.chopRate);
      const bdv = _amountLP
        .multipliedBy(pool.lpBdv)
        .multipliedBy(unripe[urBeanWeth.address]?.chopRate);
      return _denomination === 'bdv' ? bdv : usd;
    },
    [Bean, beanPools, beanWeth.address, price, unripe, urBean, urBeanWeth]
  );
};

export default useSiloTokenToFiat;
