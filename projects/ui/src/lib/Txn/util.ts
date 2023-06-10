import { StepGenerator, TokenValue } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { FarmInput } from './types';

export type GetLocalOnlyStepProps = {
  name: string;
  amount?: {
    additionalAmount?: TokenValue;
    overrideAmount?: TokenValue;
  };
};

export const makeLocalOnlyStep = ({
  name,
  amount,
}: GetLocalOnlyStepProps): FarmInput => {
  const step: StepGenerator = async (amountInStep) => {
    const getAmountIn = () => {
      const { overrideAmount, additionalAmount } = amount || {};
      if (overrideAmount) {
        return ethers.BigNumber.from(overrideAmount.toBlockchain());
      }
      if (additionalAmount) {
        return amountInStep.add(additionalAmount.toBlockchain());
      }
      return amountInStep;
    };

    return {
      name: name,
      amountOut: getAmountIn(),
      prepare: () => ({
        target: '',
        callData: '',
      }),
      decode: () => undefined,
      decodeResult: () => undefined,
    };
  };
  return { input: [step], options: { onlyLocal: true } };
};
