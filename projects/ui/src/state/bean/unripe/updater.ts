import { useCallback } from 'react';
import { useDispatch } from 'react-redux';
import useTokenMap from '~/hooks/chain/useTokenMap';
import { tokenIshEqual, tokenResult } from '~/util';
import { AddressMap, ONE_BN, ZERO_BN } from '~/constants';
import { UnripeToken } from '~/state/bean/unripe';
import useUnripeUnderlyingMap from '~/hooks/beanstalk/useUnripeUnderlying';
import BigNumber from 'bignumber.js';
import useSdk from '~/hooks/sdk';
import { AdvancedPipeStruct, Clipboard, ERC20Token } from '@beanstalk/sdk';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import { chunkArray } from '~/util/UI';
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
        const clipboard = Clipboard.encode([]);
        const results = chunkArray(
          await beanstalk.callStatic.advancedPipe(
            tokenAddresses
              .map((addr) => {
                const token = unripeTokens[addr];
                const tokenContract = token.getContract();
                const common = {
                  target: beanstalk.address,
                  clipboard,
                };

                return [
                  /// NOTE:
                  /// `getPercentPenalty` retrieves the conversion rate between Unripe -> Ripe.
                  /// In the UI, we describe the "penalty" as the % of assets forfeited
                  /// when Chopping. To keep this consistency in variable names, we rename this value
                  /// to the `Chop Rate` and then say `Chop Penalty = (1 - Chop Rate) x 100%`.
                  {
                    ...common,
                    callData: beanstalk.interface.encodeFunctionData(
                      'getPercentPenalty',
                      [addr]
                    ),
                  },
                  {
                    ...common,
                    callData: beanstalk.interface.encodeFunctionData(
                      'getTotalUnderlying',
                      [addr]
                    ),
                  },
                  {
                    target: token.address,
                    callData:
                      tokenContract.interface.encodeFunctionData('totalSupply'),
                    clipboard,
                  },
                  {
                    ...common,
                    callData: beanstalk.interface.encodeFunctionData(
                      'getRecapPaidPercent'
                    ),
                  },
                  {
                    ...common,
                    callData: beanstalk.interface.encodeFunctionData(
                      'getPenalty',
                      [addr]
                    ),
                  },
                ];
              })
              .flat() as AdvancedPipeStruct[],
            '0'
          ),
          5
        ).map((resultChunk, index) => {
          const addr = tokenAddresses[index];
          const token = unripeTokens[addr];
          const tokenContract = token.getContract();
          const penalty = beanstalk.interface.decodeFunctionResult(
            'getPenalty',
            resultChunk[4]
          )[0];

          return [
            tokenResult(token)(
              beanstalk.interface.decodeFunctionResult(
                'getPercentPenalty',
                resultChunk[0]
              )[0]
            ),
            tokenResult(unripeUnderlyingTokens[addr])(
              beanstalk.interface.decodeFunctionResult(
                'getTotalUnderlying',
                resultChunk[1]
              )[0]
            ),
            tokenResult(token)(
              tokenContract.interface.decodeFunctionResult(
                'totalSupply',
                resultChunk[2]
              )[0]
            ),
            tokenResult(token)(
              beanstalk.interface.decodeFunctionResult(
                'getRecapPaidPercent',
                resultChunk[3]
              )[0]
            ),
            tokenIshEqual(addr, unripeLP)
              ? new BigNumber(penalty.toString()).div(1e18)
              : tokenResult(token)(penalty),
          ];
        });

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
