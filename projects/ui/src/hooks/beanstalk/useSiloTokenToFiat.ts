import BigNumber from 'bignumber.js';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import Token from '~/classes/Token';
import usePrice from '~/hooks/beanstalk/usePrice';
import useGetChainToken from '~/hooks/chain/useGetChainToken';
import { BEAN, BEAN_CRV3_LP, UNRIPE_BEAN, UNRIPE_BEAN_CRV3 } from '~/constants/tokens';
import { ZERO_BN } from '~/constants';
import { AppState } from '~/state';
import { Settings } from '~/state/app';

/**
 * FIXME: this function is being called very frequently
 */
const useSiloTokenToFiat = () => {
  ///
  const getChainToken = useGetChainToken();
  const Bean          = getChainToken(BEAN);
  const BeanCrv3      = getChainToken(BEAN_CRV3_LP);
  const urBean        = getChainToken(UNRIPE_BEAN);
  const urBeanCrv3    = getChainToken(UNRIPE_BEAN_CRV3);

  ///
  const beanPools     = useSelector<AppState, AppState['_bean']['pools']>((state) => state._bean.pools);
  const unripe        = useSelector<AppState, AppState['_bean']['unripe']>((state) => state._bean.unripe);
  const price         = usePrice();
  
  return useCallback((
    _token: Token,
    _amount: BigNumber,
    _denomination: Settings['denomination'] = 'usd',
    _chop: boolean = true,
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
      return _denomination === 'bdv' ? choppedBeans : choppedBeans.times(price);
    }

    /// For everything else, use the value of the LP token via the beanPool liquidity/supply ratio.
    /// FIXME: the price contract provides this directly now to save a calculation on the frontend.
    let _poolAddress = _token.address;
    let _amountLP    = _amount;

    /// For Unripe Bean:3CRV, assume we chop to Ripe Bean:3CRV
    if (_token === urBeanCrv3) {
      _poolAddress = BeanCrv3.address;
      _amountLP    = _chop 
        ? _amount.times(unripe[urBeanCrv3.address]?.chopRate || ZERO_BN) 
        : _amount;
    }

    /// Grab pool data
    const pool = beanPools[_poolAddress];
    if (!pool || !pool?.liquidity || !pool?.supply) return ZERO_BN;

    const usd = _amountLP.div(pool.supply).times(pool.liquidity); // usd value; liquidity
    return _denomination === 'bdv' ? usd.div(price) : usd;
  }, [
    Bean, 
    BeanCrv3.address, 
    beanPools, 
    price, 
    unripe, 
    urBean, 
    urBeanCrv3
  ]);
};

export default useSiloTokenToFiat;
