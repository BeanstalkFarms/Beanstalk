import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import BigNumber from 'bignumber.js';
import { ERC20Token } from '~/classes/Token';
import { AppState } from '~/state';
import { ONE_BN, ZERO_BN } from '~/constants';
import { Token } from '@beanstalk/sdk';
import useSiloTokenToFiat from './useSiloTokenToFiat';
import useWhitelist from './useWhitelist';
import useUnripeUnderlyingMap from './useUnripeUnderlying';

export default function useTVD(token?: Token) {
  const whitelist = useWhitelist();
  const balances = useSelector<
    AppState,
    AppState['_beanstalk']['silo']['balances']
  >((state) => state._beanstalk.silo.balances);
  const unripeTokens = useSelector<AppState, AppState['_bean']['unripe']>(
    (state) => state._bean.unripe
  );
  const unripeUnderlyingTokens = useUnripeUnderlyingMap();

  const siloTokenToFiat = useSiloTokenToFiat();

  return useMemo(() => {
    const getDepositedAmount = ({ address, isUnripe }: ERC20Token) => {
      if (isUnripe) {
        const deposited = balances[address]?.TVD ?? ZERO_BN;
        const depositSupply = unripeTokens[address]?.supply ?? ONE_BN;
        return deposited
          .div(depositSupply)
          .times(unripeTokens[address]?.underlying ?? ZERO_BN);
      }
      return balances[address]?.TVD;
    };

    const { tokenTvdMap, total } = Object.values(whitelist).reduce(
      (prev, curr) => {
        let tvdByToken;
        if (curr.symbol === 'urBEANETH') {
          tvdByToken = siloTokenToFiat(
            unripeUnderlyingTokens[curr.address],
            getDepositedAmount(curr),
            'usd',
            false
          );
        } else {
          tvdByToken = siloTokenToFiat(
            curr,
            getDepositedAmount(curr),
            'usd',
            !curr.isUnripe
          );
        }
        const copy = { ...prev.tokenTvdMap };
        copy[curr.address] = tvdByToken;
        return {
          tokenTvdMap: { ...copy },
          total: prev.total.plus(tvdByToken),
        };
      },
      {
        tokenTvdMap: {} as { [address: string]: BigNumber },
        total: ZERO_BN,
      }
    );

    const pctTVD =
      token && token.address in tokenTvdMap
        ? tokenTvdMap[token.address].div(total)
        : ZERO_BN;

    return {
      pctTotalTVD: pctTVD.times(100),
      tvdByToken: tokenTvdMap,
      total,
    };
  }, [
    token,
    balances,
    siloTokenToFiat,
    unripeTokens,
    unripeUnderlyingTokens,
    whitelist,
  ]);
}
