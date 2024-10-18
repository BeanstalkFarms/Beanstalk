import { useCallback } from 'react';
import { useDispatch } from 'react-redux';

import { useERC20Contract } from '~/hooks/ledger/useContract';
import { tokenResult, bigNumberResult } from '~/util';
import useChainId from '~/hooks/chain/useChainId';
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

  // Contracts
  const beanstalk = sdk.contracts.beanstalk;
  const fertContract = sdk.contracts.fertilizer;
  const [usdcContract] = useERC20Contract(sdk.tokens.USDC.address);

  // Handlers
  const fetch = useCallback(async () => {
    const { BEAN, UNRIPE_BEAN } = sdk.tokens;
    if (fertContract && usdcContract) {
      console.debug('[beanstalk/fertilizer/updater] FETCH');
      const [
        remainingRecapitalization,
        humidity,
        currentBpf,
        endBpf,
        unfertilized,
        fertilized,
        recapFundedPct,
      ] = await Promise.all([
        beanstalk.remainingRecapitalization().then(tokenResult(BEAN)),
        beanstalk.getCurrentHumidity().then(bigNumberResult),
        beanstalk.beansPerFertilizer().then(bigNumberResult),
        beanstalk.getEndBpf().then(bigNumberResult),
        beanstalk.totalUnfertilizedBeans().then(tokenResult(BEAN)),
        beanstalk.totalFertilizedBeans().then(tokenResult(BEAN)),
        beanstalk
          .getRecapFundedPercent(UNRIPE_BEAN.address)
          .then(tokenResult(UNRIPE_BEAN)),
      ] as const);
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
  }, [sdk.tokens, fertContract, usdcContract, beanstalk, dispatch]);
  const clear = useCallback(() => {
    dispatch(resetBarn());
  }, [dispatch]);

  return [fetch, clear] as const;
};

const BarnUpdater = () => {
  const [fetch, clear] = useFetchBeanstalkBarn();
  const chainId = useChainId();

  useL2OnlyEffect(() => {
    clear();
    fetch();
  }, []);

  return null;
};

export default BarnUpdater;
