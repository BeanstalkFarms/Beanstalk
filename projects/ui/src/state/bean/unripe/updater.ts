import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useBeanstalkContract } from '~/hooks/ledger/useContract';
import useChainId from '~/hooks/chain/useChainId';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { tokenResult } from '~/util';
import { AddressMap, ONE_BN } from '~/constants';
import { UNRIPE_TOKENS } from '~/constants/tokens';
import { resetUnripe, updateUnripe } from './actions';
import { UnripeToken } from '~/state/bean/unripe';
import useUnripeUnderlyingMap from '~/hooks/beanstalk/useUnripeUnderlying';

export const useUnripe = () => {
  const dispatch = useDispatch();
  const beanstalk = useBeanstalkContract();
  const unripeTokens = useTokenMap(UNRIPE_TOKENS);
  const unripeUnderlyingTokens = useUnripeUnderlyingMap(); // [unripe token address] => Ripe Token

  const fetch = useCallback(async () => {
    if (beanstalk) {
      try {
        const tokenAddresses = Object.keys(unripeTokens); // ['0x1BEA0', '0x1BEA1']
        const results = await Promise.all(
          tokenAddresses.map(async (addr) => (
            Promise.all([
              /// NOTE:
              /// `getPercentPenalty` retrieves the conversion rate between Unripe -> Ripe.
              /// In the UI, we describe the "penalty" as the % of assets forfeited
              /// when Chopping. To keep this consistency in variable names, we rename this value
              /// to the `Chop Rate` and then say `Chop Penalty = (1 - Chop Rate) x 100%`.
              beanstalk.getPercentPenalty(addr).then(tokenResult(unripeTokens[addr])),
              beanstalk.getTotalUnderlying(addr).then(tokenResult(unripeUnderlyingTokens[addr])),
              unripeTokens[addr].getTotalSupply().then(tokenResult(unripeTokens[addr])),
            ])
          ))
        );
        
        const data =  tokenAddresses.reduce<AddressMap<UnripeToken>>((prev, key, index) => {
          const chopRate = results[index][0];
          prev[key] = {
            chopRate:     chopRate,
            chopPenalty:  ONE_BN.minus(chopRate).times(100),
            underlying:   results[index][1],
            supply:       results[index][2],
          };
          return prev;
        }, {});

        dispatch(updateUnripe(data));
      } catch (err) {
        console.error(err);
      }
    }
  }, [beanstalk, unripeTokens, dispatch, unripeUnderlyingTokens]);

  const clear = useCallback(() => {
    dispatch(resetUnripe());
  }, [dispatch]);

  return [fetch, clear] as const;
};

const UnripeUpdater = () => {
  const [fetch, clear] = useUnripe();
  const chainId = useChainId();
  
  useEffect(() => {
    clear();
    fetch();
    // NOTE: 
    // The below requires that useChainId() is called last in the stack of hooks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId]);

  return null;
};

export default UnripeUpdater;
