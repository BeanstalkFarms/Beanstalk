import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { AdvancedPipeStruct, Clipboard } from '@beanstalk/sdk';
import { tokenResult, bigNumberResult } from '~/util';
import { ZERO_BN } from '~/constants';
import useSdk from '~/hooks/sdk';
import useL2OnlyEffect from '~/hooks/chain/useL2OnlyEffect';
import { resetBarn, updateBarn } from './actions';

// const fetchGlobal = fetch;
// const fetchFertilizerTotalSupply = async (): Promise<BigNumber> =>
//   fetchGlobal('https://api.thegraph.com/subgraphs/name/publiuss/fertilizer', {
//     method: 'POST',
//     body: JSON.stringify({
//       query: `
//         query {
//           fertilizers {
//             totalSupply
//           }
//         }
//       `
//     })
//   }).then((r) => r.json()).then((r) => new BigNumber(r.data.fertilizers?.[0]?.totalSupply || 0));

export const useFetchBeanstalkBarn = () => {
  const dispatch = useDispatch();
  const sdk = useSdk();

  // Handlers
  const fetch = useCallback(async () => {
    const { BEAN, UNRIPE_BEAN } = sdk.tokens;
    const beanstalk = sdk.contracts.beanstalk;

    if (beanstalk) {
      console.debug('[beanstalk/fertilizer/updater] FETCH');

      const common = {
        target: beanstalk.address,
        clipboard: Clipboard.encode([]),
      };

      const calls: AdvancedPipeStruct[] = [
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData(
            'remainingRecapitalization'
          ),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData(
            'getCurrentHumidity'
          ),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData(
            'beansPerFertilizer'
          ),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData('getEndBpf'),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData(
            'totalUnfertilizedBeans'
          ),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData(
            'totalFertilizedBeans'
          ),
        },
        {
          ...common,
          callData: beanstalk.interface.encodeFunctionData(
            'getRecapFundedPercent',
            [UNRIPE_BEAN.address]
          ),
        },
      ];

      const results = await beanstalk.callStatic.advancedPipe(calls, '0');
      const remainingRecapitalization = tokenResult(BEAN)(
        beanstalk.interface.decodeFunctionResult(
          'remainingRecapitalization',
          results[0]
        )[0]
      );
      const humidity = bigNumberResult(
        beanstalk.interface.decodeFunctionResult(
          'getCurrentHumidity',
          results[1]
        )[0]
      );
      const currentBpf = bigNumberResult(
        beanstalk.interface.decodeFunctionResult(
          'beansPerFertilizer',
          results[2]
        )[0]
      );
      const endBpf = bigNumberResult(
        beanstalk.interface.decodeFunctionResult('getEndBpf', results[3])[0]
      );
      const unfertilized = tokenResult(BEAN)(
        beanstalk.interface.decodeFunctionResult(
          'totalUnfertilizedBeans',
          results[4]
        )[0]
      );
      const fertilized = tokenResult(BEAN)(
        beanstalk.interface.decodeFunctionResult(
          'totalFertilizedBeans',
          results[5]
        )[0]
      );
      const recapFundedPct = tokenResult(UNRIPE_BEAN)(
        beanstalk.interface.decodeFunctionResult(
          'getRecapFundedPercent',
          results[6]
        )[0]
      );

      console.debug(
        `[beanstalk/fertilizer/updater] RESULT: remaining = ${remainingRecapitalization.toFixed(
          2
        )}`
      );
      dispatch(
        updateBarn({
          remaining: remainingRecapitalization, // FIXME rename
          totalRaised: ZERO_BN,
          humidity, //
          currentBpf, //
          endBpf, //
          unfertilized, //
          fertilized,
          recapFundedPct,
        })
      );
    }
  }, [sdk, dispatch]);
  const clear = useCallback(() => {
    dispatch(resetBarn());
  }, [dispatch]);

  return [fetch, clear] as const;
};

const BarnUpdater = () => {
  const [fetch, clear] = useFetchBeanstalkBarn();

  useL2OnlyEffect(() => {
    clear();
    fetch();
  }, []);

  return null;
};

export default BarnUpdater;
