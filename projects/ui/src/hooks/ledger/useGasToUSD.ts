import BigNumber from 'bignumber.js';
import { useCallback } from 'react';
import { useSelector } from 'react-redux';
import { AppState, useAppSelector } from '~/state';
import { useBalanceTokens } from '../beanstalk/useTokens';

/**
 * Convert a gas limit from estimateGas into a USD gas price.
 *
 * Gas units (limit)         beanstalk.estimateGas.someFunction() returns gas limit (gwei)
 *   (Base Fee)              prices.baseFeePerGas (in wei)
 *   (gasPrice)              prices.gasPrice (in wei)
 *   (X USD / 1 ETH)         prices.ethusd
 */
const useGasToUSD = () => {
  const prices = useSelector<AppState, AppState['app']['ethPrices']>(
    (state) => state.app.ethPrices
  );
  const { ETH } = useBalanceTokens();
  const ethPrice = useAppSelector((s) => s._beanstalk.tokenPrices.eth);

  return useCallback(
    (gasLimit?: BigNumber) => {
      const baseFee = prices?.baseFeePerGas;
      const gasPrice = prices?.gasPrice;

      if (!baseFee || !gasPrice || !gasLimit || !ethPrice) return null;

      const l1Fee = baseFee.times(gasLimit);
      const totalFee = l1Fee.plus(gasPrice);
      const _ttlFee = new BigNumber(
        ETH.fromBlockchain(totalFee.toString()).toHuman()
      );
      const usd = _ttlFee.times(ethPrice);

      return usd;
    },
    [prices?.baseFeePerGas, prices?.gasPrice, ETH, ethPrice]
  );
};

export default useGasToUSD;
