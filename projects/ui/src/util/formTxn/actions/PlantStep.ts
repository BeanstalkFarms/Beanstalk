import { StepGenerator, TokenValue } from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { FormTxn } from '~/util/formTxn';
import FormTxnAction from '~/util/formTxn/FormTxnAction';

export default class PlantStep extends FormTxnAction<FormTxn.PLANT> {
  implied = [];

  async estimateGas() {
    return this._sdk.contracts.beanstalk.estimateGas.plant();
  }

  getSteps() {
    const { beanstalk } = this._sdk.contracts;
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

    return [step];
  }

  /// PlantStep specific utils

  makePlantCrateSync(earnedBeans: TokenValue, season: number) {
    const { BEAN, STALK } = this._sdk.tokens;

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
    const { BEAN, STALK } = this._sdk.tokens;
    const { beanstalk } = this._sdk.contracts;

    const [_season, _earned] = await Promise.all([
      this._sdk.sun.getSeason(),
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
