import { StepGenerator, Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { TokenMap } from '~/constants';
import { DepositCrate, FarmerSiloBalance } from '~/state/farmer/silo';

import { FormTxn } from '~/util/formTxn';
import FormTxnAction from '~/util/formTxn/FormTxnAction';

enum EnrootType {
  DEPOSIT = 'DEPOSIT',
  DEPOSITS = 'DEPOSITS',
}

export default class EnrootStep extends FormTxnAction<FormTxn.ENROOT> {
  implied = [FormTxn.MOW];

  private _getCallData() {
    const { beanstalk } = this._sdk.contracts;
    const params = this.getParams();

    const callData: { [key in EnrootType]: string[] } = {
      [EnrootType.DEPOSIT]: [],
      [EnrootType.DEPOSITS]: [],
    };

    [...this._sdk.tokens.unripeTokens].forEach((urToken) => {
      const crates = params.crates[urToken.address];
      if (crates?.length === 1) {
        const encoded = beanstalk.interface.encodeFunctionData(
          'enrootDeposit',
          [
            urToken.address,
            crates[0].season.toString(),
            urToken.fromHuman(crates[0].amount.toString()).toBlockchain(),
          ]
        );
        callData[EnrootType.DEPOSIT] = [...[EnrootType.DEPOSIT], encoded];
      } else if (crates.length > 1) {
        const encoded = beanstalk.interface.encodeFunctionData(
          'enrootDeposits',
          [
            urToken.address,
            crates.map((crate) => crate.season.toString()),
            crates.map((crate) =>
              urToken.fromHuman(crate.amount.toString()).toBlockchain()
            ),
          ]
        );

        callData[EnrootType.DEPOSITS] = [
          ...callData[EnrootType.DEPOSITS],
          encoded,
        ];
      }
    });

    return callData;
  }

  async estimateGas() {
    return this._sdk.contracts.beanstalk.estimateGas.farm(
      Object.values(this._getCallData()).reduce<string[]>(
        (prev, curr) => [...prev, ...curr],
        []
      )
    );
  }

  getSteps() {
    const { beanstalk } = this._sdk.contracts;
    const steps: StepGenerator[] = [];

    Object.entries(this._getCallData()).forEach(([k, callDatas]) => {
      const key = k as EnrootType;
      if (key === EnrootType.DEPOSIT) {
        callDatas.forEach((callData) => {
          steps.push(async (_amountInStep) => ({
            name: 'enrootDeposit',
            amountOut: _amountInStep,
            prepare: () => ({
              target: beanstalk.address,
              callData,
            }),
            decode: (data: string) =>
              beanstalk.interface.decodeFunctionData('enrootDeposit', data),
            decodeResult: (result: string) =>
              beanstalk.interface.decodeFunctionResult('enrootDeposit', result),
          }));
        });
      } else if (key === EnrootType.DEPOSITS) {
        callDatas.forEach((callData) => {
          steps.push(async (_amountInStep) => ({
            name: 'enrootDeposits',
            amountOut: _amountInStep,
            prepare: () => ({
              target: beanstalk.address,
              callData,
            }),
            decode: (data: string) =>
              beanstalk.interface.decodeFunctionData('enrootDeposits', data),
            decodeResult: (result: string) =>
              beanstalk.interface.decodeFunctionResult(
                'enrootDeposits',
                result
              ),
          }));
        });
      }
    });

    return steps;
  }

  pickCrates(
    balances: TokenMap<FarmerSiloBalance>,
    getBDV: (token: Token) => BigNumber
  ) {
    const unripe = [...this._sdk.tokens.unripeTokens];
    return unripe.reduce<TokenMap<DepositCrate[]>>((prev, token) => {
      const balance = balances[token.address];
      const depositCrates = balance?.deposited.crates;

      prev[token.address] = depositCrates?.filter((crate) => {
        const bdv = getBDV(token).times(crate.amount).toFixed(6, 1);
        return new BigNumber(bdv).gt(crate.bdv);
      });

      return prev;
    }, {});
  }
}
