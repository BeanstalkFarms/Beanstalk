import { ERC20Token } from '@beanstalk/sdk';
import { useCallback } from 'react';
import { useAppSelector } from '~/state';
import { getTokenIndex } from '~/util';

import BigNumber from 'bignumber.js';
import useSdk from '../sdk';
import { useBalanceTokens } from './useTokens';

(BigNumber.prototype as any)[Symbol.for('nodejs.util.inspect.custom')] =
  function logBigNumber() {
    return `${this.toString()}`;
  };

export const WELL_MINIMUM_BEAN_BALANCE = 1_000;

export const useCalcWellHasMinReserves = () => {
  const sdk = useSdk();
  const { BEAN } = useBalanceTokens();

  const pools = useAppSelector((state) => state._bean.pools);

  const getHasMinReserves = useCallback(
    (token: ERC20Token) => {
      if (token.equals(BEAN)) return true;

      const well = sdk.pools.getWellByLPToken(token);
      const wellData = pools[getTokenIndex(token)];

      if (!well || !wellData) return true;

      const tokenIndexes = well.getBeanWellTokenIndexes();
      const beanReserve = wellData.reserves[tokenIndexes.bean];

      const hasMinBeanReserves = beanReserve?.gt(WELL_MINIMUM_BEAN_BALANCE);

      return hasMinBeanReserves;
    },
    [BEAN, sdk, pools]
  );

  return getHasMinReserves;
};
