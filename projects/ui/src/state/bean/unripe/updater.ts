import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { tokenIshEqual, tokenResult } from '~/util';
import { AddressMap, ONE_BN, ZERO_BN } from '~/constants';
import { UnripeToken } from '~/state/bean/unripe';
import useUnripeUnderlyingMap from '~/hooks/beanstalk/useUnripeUnderlying';
import BigNumber from 'bignumber.js';
import useSdk from '~/hooks/sdk';
import { ERC20Token } from '@beanstalk/sdk';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import { resetUnripe, updateUnripe } from './actions';

export const useUnripe = () => {
  const dispatch = useDispatch();
  const sdk = useSdk();
  const beanstalk = sdk.contracts.beanstalk;
  const unripeTokens = useTokenMap(sdk.tokens.unripeTokens as Set<ERC20Token>);
  const unripeUnderlyingTokens = useUnripeUnderlyingMap(); // [unripe token address] => Ripe Token
  const unripeLP = sdk.tokens.UNRIPE_BEAN_WSTETH;

  const fetch = useCallback(async () => {
    if (beanstalk) {
      try {
        const tokenAddresses = Object.keys(unripeTokens); // ['0x1BEA0', '0x1BEA1']
        const results = await Promise.all(
          tokenAddresses.map(async (addr) =>
            Promise.all([
              /// NOTE:
              /// `getPercentPenalty` retrieves the conversion rate between Unripe -> Ripe.
              /// In the UI, we describe the "penalty" as the % of assets forfeited
              /// when Chopping. To keep this consistency in variable names, we rename this value
              /// to the `Chop Rate` and then say `Chop Penalty = (1 - Chop Rate) x 100%`.
              beanstalk
                .getPercentPenalty(addr)
                .then(tokenResult(unripeTokens[addr])),
              beanstalk
                .getTotalUnderlying(addr)
                .then(tokenResult(unripeUnderlyingTokens[addr])),
              unripeTokens[addr]
                ?.getTotalSupply()
                ?.then(tokenResult(unripeTokens[addr])),
              beanstalk
                .getRecapPaidPercent()
                .then(tokenResult(unripeTokens[addr])),
              beanstalk.getPenalty(addr).then((result) => {
                if (tokenIshEqual(addr, unripeLP)) {
                  // handle this case separately b/c urBEAN:ETH LP liquidity was originally
                  // bean:3crv, which had 18 decimals
                  return new BigNumber(result.toString()).div(1e18);
                }
                return tokenResult(unripeTokens[addr])(result);
              }),
            ])
          )
        );

        const data = tokenAddresses.reduce<AddressMap<UnripeToken>>(
          (prev, key, index) => {
            const chopRate = results[index][0];
            prev[key] = {
              chopRate: chopRate,
              chopPenalty: ONE_BN.minus(chopRate).times(100),
              underlying: results[index][1],
              supply: results[index][2] || ZERO_BN,
              recapPaidPercent: results[index][3],
              penalty: results[index][4],
            };
            return prev;
          },
          {}
        );

        dispatch(updateUnripe(data));
      } catch (err) {
        console.error(err);
      }
    }
  }, [beanstalk, unripeTokens, dispatch, unripeUnderlyingTokens, unripeLP]);

  const clear = useCallback(() => {
    dispatch(resetUnripe());
  }, [dispatch]);

  return [fetch, clear] as const;
};

const UnripeUpdater = () => {
  const [fetch, clear] = useUnripe();

  useL2OnlyEffect(() => {
    clear();
    fetch();
  }, []);

  return null;
};

export default UnripeUpdater;
