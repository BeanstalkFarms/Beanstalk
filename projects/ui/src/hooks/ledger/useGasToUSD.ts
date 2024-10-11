import BigNumber from 'bignumber.js';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { AppState } from '~/state';
import { useBalanceTokens } from '../beanstalk/useTokens';

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
  const prices = useSelector<AppState, AppState['app']['ethPrices']>(
    (state) => state.app.ethPrices
  );
  const { ETH } = useBalanceTokens();

  return useCallback(
    (gasLimit?: BigNumber) => {
      const baseFee = prices?.baseFeePerGas;
      const gasPrice = prices?.gasPrice;
      const ethUsd = prices?.ethusd;

      if (!baseFee || !gasPrice || !ethUsd || !gasLimit) return null;

      const l1Fee = baseFee.times(gasLimit);
      const totalFee = l1Fee.plus(gasPrice);
      const _ttlFee = new BigNumber(
        ETH.fromBlockchain(totalFee.toString()).toHuman()
      );
      const usd = _ttlFee.times(ethUsd.toNumber());

      return usd;
    },
    [prices?.baseFeePerGas, prices?.gasPrice, prices?.ethusd, ETH]
  );
};

export default useGasToUSD;
