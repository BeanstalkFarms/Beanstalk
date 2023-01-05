import { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { BEAN, UNRIPE_BEAN } from '../../../constants/tokens';

import { USDC_ADDRESSES } from '~/constants/addresses';

import { useBeanstalkContract, useBeanstalkFertilizerContract, useERC20Contract } from '~/hooks/ledger/useContract';
import { tokenResult, bigNumberResult } from '~/util';
import useChainId from '~/hooks/chain/useChainId';
import { resetBarn, updateBarn } from './actions';
import { ZERO_BN } from '~/constants';

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
  const dispatch        = useDispatch();
  const beanstalk       = useBeanstalkContract();
  const [fertContract]  = useBeanstalkFertilizerContract();
  const [usdcContract]  = useERC20Contract(USDC_ADDRESSES);

  // Handlers
  const fetch = useCallback(async () => {
    if (fertContract && usdcContract) {
      console.debug('[beanstalk/fertilizer/updater] FETCH');
      const [
        remainingRecapitalization,
        humidity,
        currentBpf,
        endBpf,
        unfertilized,
        fertilized,
        recapFundedPct
      ] = await Promise.all([
        beanstalk.remainingRecapitalization().then(tokenResult(BEAN)),
        beanstalk.getCurrentHumidity().then(bigNumberResult),
        beanstalk.beansPerFertilizer().then(bigNumberResult),
        beanstalk.getEndBpf().then(bigNumberResult),
        beanstalk.totalUnfertilizedBeans().then(tokenResult(BEAN)),
        beanstalk.totalFertilizedBeans().then(tokenResult(BEAN)),
        beanstalk.getRecapFundedPercent(UNRIPE_BEAN[1].address).then(tokenResult(UNRIPE_BEAN)),
      ] as const);
      console.debug(`[beanstalk/fertilizer/updater] RESULT: remaining = ${remainingRecapitalization.toFixed(2)}`);
      dispatch(updateBarn({
        remaining: remainingRecapitalization, // FIXME rename
        totalRaised: ZERO_BN,
        humidity,     //
        currentBpf,   //
        endBpf,       //
        unfertilized,  //
        fertilized,
        recapFundedPct,
      }));
    }
  }, [
    dispatch,
    beanstalk,
    fertContract,
    usdcContract
  ]); 
  const clear = useCallback(() => {
    dispatch(resetBarn());
  }, [dispatch]);

  return [fetch, clear] as const;
};

const BarnUpdater = () => {
  const [fetch, clear] = useFetchBeanstalkBarn();
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

export default BarnUpdater;
