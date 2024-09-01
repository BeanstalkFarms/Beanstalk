import BigNumber from 'bignumber.js';
import { useCallback, useMemo } from 'react';

import { TokenMap, ZERO_BN } from '~/constants';
import { ERC20Token, NativeToken } from '@beanstalk/sdk';
import useDataFeedTokenPrices from '../beanstalk/useDataFeedTokenPrices';
import useFarmerBalances from './useFarmerBalances';
import useFarmerBalancesBreakdown from './useFarmerBalancesBreakdown';
import { useWhitelistedTokens } from '../beanstalk/useTokens';

const sortMap = {
  BEAN: 0,
  BEAN3CRV: 1,
  urBEAN: 2,
  urBEAN3CRV: 3,
  ETH: 4,
  WETH: 5,
  '3CRV': 6,
  DAI: 7,
  USDC: 8,
  USDT: 9,
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
  const { whitelist, tokenMap } = useWhitelistedTokens();

  // data
  const breakdown = useFarmerBalancesBreakdown();
  const farmerBalances = useFarmerBalances();
  const tokenPrices = useDataFeedTokenPrices();

  // helpers
  const getBalances = useCallback(
    (addr: string) => ({
      farm: farmerBalances?.[addr]?.internal ?? ZERO_BN,
      circulating: farmerBalances?.[addr]?.external ?? ZERO_BN,
    }),
    [farmerBalances]
  );

  const balanceData = useMemo(() => {
    const internal: TokenMap<TokenBalanceWithFiatValue> = {};
    const external: TokenMap<TokenBalanceWithFiatValue> = {};

    whitelist.forEach((token) => {
      const balance = getBalances(token.address);
      const value = tokenPrices[token.address] ?? ZERO_BN;
      if (balance.farm?.gt(0) || includeZero) {
        internal[token.address] = {
          token,
          amount: balance.farm,
          value: balance.farm.multipliedBy(value),
        };
      }
      if (balance.circulating?.gt(0) || includeZero) {
        external[token.address] = {
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
        internal[addr] = {
          token,
          amount,
          value,
        };
      }
      if (circulating[addr]?.amount?.gt(0) || includeZero) {
        external[addr] = {
          token,
          amount: circulating[addr]?.amount ?? ZERO_BN,
          value: circulating[addr]?.value ?? ZERO_BN,
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
    whitelist,
    breakdown.states.farm.byToken,
    breakdown.states.circulating.byToken,
    getBalances,
    tokenPrices,
    includeZero,
    tokenMap,
  ]);

  return balanceData;
}
