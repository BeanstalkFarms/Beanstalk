import BigNumber from 'bignumber.js';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import Token from '~/classes/Token';
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

      const _poolAddress = _token.address;
      const _amountLP = _amount;

      if (_token === urBeanWstETH) {
        // formula for calculating chopped urBEANWstETH LP:
        // userUrLP * totalUnderlyingLP / totalSupplyUrLP * recapPaidPercent
        const underlyingTotalLP = unripe[urBeanWstETH.address]?.underlying;
        const totalSupplyUrLP = unripe[urBeanWstETH.address]?.supply;
        const recapPaidPercent = unripe[urBeanWstETH.address]?.recapPaidPercent;
        const choppedLP = _amount
          .multipliedBy(underlyingTotalLP)
          .dividedBy(totalSupplyUrLP)
          .multipliedBy(recapPaidPercent);

        // console.log(`underlyingTotalLP`, underlyingTotalLP.toString()); // 285772.366579734565388865
        // console.log(`totalSupplyUrLP`, totalSupplyUrLP.toString()); // 101482689.1786
        // console.log(`recapPaidPercent`, recapPaidPercent.toString()); // 0.006132
        // console.log(`amountLP`, _amount.toString()); // 370168.862647
        // console.log(`choppedLP`, choppedLP.toString()); // 6.39190475675572378624622472
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
