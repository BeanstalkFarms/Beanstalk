import BigNumber from 'bignumber.js';
import { useCallback, useMemo } from 'react';

import { TokenMap, ZERO_BN } from '~/constants';
import { ERC20Token, NativeToken } from '@beanstalk/sdk';
import { getTokenIndex } from '~/util';
import {
  TokenInstance,
  useSupportedBalanceTokens,
} from '../beanstalk/useTokens';
import useDataFeedTokenPrices from '../beanstalk/useDataFeedTokenPrices';
import useFarmerBalances from './useFarmerBalances';
import useFarmerBalancesBreakdown from './useFarmerBalancesBreakdown';

const sortMap = {
  BEAN: 0,
  BEANETH: 1,
  BEANwstETH: 2,
  BEANweETH: 3,
  BEANWBTC: 4,
  BEANUSDC: 5,
  BEANUSDT: 6,
  urBEAN: 7,
  urBEANwstETH: 8,
  ETH: 9,
  WETH: 10,
  wstETH: 11,
  weETH: 12,
  WBTC: 13,
  USDC: 14,
  USDT: 15,
  DAI: 16,
} as const;

export type TokenBalanceWithFiatValue = {
  token: ERC20Token | NativeToken;
  amount: BigNumber;
  value: BigNumber;
};

const sortTokens = (
  a: TokenBalanceWithFiatValue,
  b: TokenBalanceWithFiatValue
) => {
  const tkA = sortMap[a.token.symbol as keyof typeof sortMap];
  const tkB = sortMap[b.token.symbol as keyof typeof sortMap];
  return tkA - tkB;
};

/**
 * Organizes farmer external & internal balance and returns balance data w/ fiat value of each balance
 * @param includeZero
 */
export default function useFarmerBalancesWithFiatValue(includeZero?: boolean) {
  // constants
  const { tokens, tokenMap } = useSupportedBalanceTokens();

  // data
  const breakdown = useFarmerBalancesBreakdown();
  const farmerBalances = useFarmerBalances();
  const tokenPrices = useDataFeedTokenPrices();

  // helpers
  const getBalances = useCallback(
    (token: TokenInstance) => ({
      farm: farmerBalances?.[getTokenIndex(token)]?.internal ?? ZERO_BN,
      circulating: farmerBalances?.[getTokenIndex(token)]?.external ?? ZERO_BN,
    }),
    [farmerBalances]
  );

  const balanceData = useMemo(() => {
    const internal: TokenMap<TokenBalanceWithFiatValue> = {};
    const external: TokenMap<TokenBalanceWithFiatValue> = {};

    tokens.forEach((token) => {
      const balance = getBalances(token);
      const value = tokenPrices[getTokenIndex(token)] ?? ZERO_BN;
      if (balance.farm?.gt(0) || includeZero) {
        internal[getTokenIndex(token)] = {
          token,
          amount: balance.farm,
          value: balance.farm.multipliedBy(value),
        };
      }
      if (balance.circulating?.gt(0) || includeZero) {
        external[getTokenIndex(token)] = {
          token,
          amount: balance.circulating,
          value: balance.circulating.multipliedBy(value),
        };
      }
    });

    const farm = Object.entries(breakdown.states.farm.byToken);
    const circulating = breakdown.states.circulating.byToken;

    farm.forEach(([addr, { value, amount }]) => {
      const token = tokenMap[addr];
      if (!token) return;
      if (amount?.gt(0) || includeZero) {
        internal[getTokenIndex(token)] = {
          token,
          amount,
          value,
        };
      }
      if (circulating[getTokenIndex(token)]?.amount?.gt(0) || includeZero) {
        external[getTokenIndex(token)] = {
          token,
          amount: circulating[getTokenIndex(token)]?.amount ?? ZERO_BN,
          value: circulating[getTokenIndex(token)]?.value ?? ZERO_BN,
        };
      }
    });

    const _internal = Object.values(internal).sort(sortTokens);
    const _external = Object.values(external).sort(sortTokens);

    return {
      internal: _internal,
      external: _external,
    };
  }, [
    tokens,
    breakdown.states.farm.byToken,
    breakdown.states.circulating.byToken,
    getBalances,
    tokenPrices,
    includeZero,
    tokenMap,
  ]);

  return balanceData;
}
