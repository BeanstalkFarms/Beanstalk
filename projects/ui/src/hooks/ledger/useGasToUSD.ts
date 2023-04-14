import BigNumber from 'bignumber.js';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { AppState } from '~/state';

const ETH_PER_GWEI = new BigNumber(10).pow(-9);

/**
 * Convert a gas limit from estimateGas into a USD gas price.
 *
 * Gas units (limit)         beanstalk.estimateGas.someFunction() returns gas limit (gwei)
 *   (Base Fee + Tip (gwei)) prices.gas.safe (in gwei)
 *   (1 ETH / 10^9 gwei)     constant
 *   (X USD / 1 ETH)         prices.ethusd
 */
const useGasToUSD = () => {
  const prices = useSelector<AppState, AppState['app']['ethPrices']>((state) => state.app.ethPrices);
  return useCallback((gasLimit?: BigNumber) => {
    if (!prices || !gasLimit) return null; 
    return (
      gasLimit
        .times(prices.gas.safe)
        .times(ETH_PER_GWEI)
        .times(prices.ethusd)
    );
  }, [prices]);
};

export default useGasToUSD;
