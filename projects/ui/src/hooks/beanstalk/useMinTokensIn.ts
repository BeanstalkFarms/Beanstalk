import { Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { useAppSelector } from '~/state';
import { getTokenIndex, tokenIshEqual } from '~/util';
import { useMemo } from 'react';
import { ZERO_BN } from '~/constants';
import usePrice from './usePrice';
import { useBalanceTokens } from './useTokens';

const DEFAULT_MIN = new BigNumber(1e-6);

export function useMinTokensIn(tokenIn: Token, tokenOut: Token) {
  const priceMap = useAppSelector((s) => s._beanstalk.tokenPrices);
  const tokens = useBalanceTokens();
  const beanPrice = usePrice();

  const min = useMemo(() => {
    const getUsdValue = (t: Token) => {
      if (tokenIshEqual(tokens.BEAN, t)) {
        return beanPrice;
      }
      return priceMap[getTokenIndex(t)];
    };

    const usdTokenIn1 = getUsdValue(tokenIn);
    const usdTokenOut1 = getUsdValue(tokenOut);

    if (!usdTokenIn1 || !usdTokenOut1) {
      return DEFAULT_MIN;
    }

    if (tokenIn.equals(tokens.ETH)) {
      if (tokenOut.equals(tokens.WETH)) return ZERO_BN;
    }

    if (tokenOut.equals(tokens.WETH)) {
      if (tokenIn.equals(tokens.ETH)) return ZERO_BN;
    }

    if (tokenIshEqual(tokenIn, tokenOut)) {
      return ZERO_BN;
    }

    if (tokenIn.decimals >= 8) {
      return new BigNumber(10).pow(-8);
    }
    return new BigNumber(10).pow(-tokenIn.decimals);
  }, [tokens, beanPrice, priceMap, tokenIn, tokenOut]);

  return min;
}
