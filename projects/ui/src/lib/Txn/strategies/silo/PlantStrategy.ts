/* eslint-disable class-methods-use-this */
import { StepGenerator, TokenValue } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { FarmStepStrategy, EstimatesGas } from '~/lib/Txn/Strategy';

export class PlantStrategy extends FarmStepStrategy implements EstimatesGas {
  async estimateGas(): Promise<ethers.BigNumber> {
    const { beanstalk } = PlantStrategy.sdk.contracts;
    const gasEstimate = await beanstalk.estimateGas.plant();
    console.debug(`[PlantStrategy][estimateGas]: `, gasEstimate.toString());

    return gasEstimate;
  }

  getSteps() {
    const { beanstalk } = PlantStrategy.sdk.contracts;

    const step: StepGenerator = async (_amountInStep) => ({
      name: 'plant',
      amountOut: _amountInStep,
      prepare: () => ({
        target: beanstalk.address,
        callData: beanstalk.interface.encodeFunctionData('plant', undefined),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('plant', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('plant', result),
    });

    const _steps = { steps: PlantStrategy.normaliseSteps(step) };
    console.debug('[PlantStrategy][getSteps]: ', _steps);

    return _steps;
  }

  /// PlantStrategy specific utils
  makePlantCrateSync(earnedBeans: TokenValue, season: number) {
    const { BEAN, STALK } = PlantStrategy.sdk.tokens;

    const seeds = BEAN.getSeeds(earnedBeans);
    const stalk = BEAN.getStalk(earnedBeans);
    const grownStalk = STALK.amount(0);

    const crate = {
      season: ethers.BigNumber.from(season),
      amount: earnedBeans,
      bdv: earnedBeans,
      stalk,
      baseStalk: stalk,
      grownStalk,
      seeds,
    };

    return {
      canPlant: earnedBeans.gt(0),
      amount: earnedBeans,
      crate,
    };
  }

  async makePlantCrate(account: string) {
    const { beanstalk } = PlantStrategy.sdk.contracts;
    const { BEAN, STALK } = PlantStrategy.sdk.tokens;

    const [_season, _earned] = await Promise.all([
      PlantStrategy.sdk.sun.getSeason(),
      beanstalk.balanceOfEarnedBeans(account),
    ]);

    const earnedBeans = BEAN.fromBlockchain(_earned);
    const seeds = BEAN.getSeeds(earnedBeans);
    const stalk = BEAN.getStalk(earnedBeans);
    const grownStalk = STALK.amount(0);

    const crate = {
      season: ethers.BigNumber.from(_season),
      amount: earnedBeans,
      bdv: earnedBeans,
      stalk,
      baseStalk: stalk,
      grownStalk,
      seeds,
    };

    return {
      canPlant: earnedBeans.gt(0),
      amount: earnedBeans,
      crate,
    };
  }
}
