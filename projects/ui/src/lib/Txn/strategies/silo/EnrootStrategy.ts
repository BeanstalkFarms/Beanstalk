import { BeanstalkSDK, StepGenerator, Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { TokenMap } from '~/constants';
import { DepositCrate, FarmerSiloBalance } from '~/state/farmer/silo';

import { FarmStepStrategy, EstimatesGas } from '~/lib/Txn/Strategy';

enum EnrootType {
  DEPOSIT = 'DEPOSIT',
  DEPOSITS = 'DEPOSITS',
}

export class EnrootStrategy extends FarmStepStrategy implements EstimatesGas {
  constructor(
    _sdk: BeanstalkSDK,
    private _params: {
      crates: Record<string, DepositCrate[]>;
    }
  ) {
    super(_sdk);
    this._params = _params;
  }

  private _getCallData() {
    const { beanstalk } = EnrootStrategy.sdk.contracts;

    const callData: { [key in EnrootType]: string[] } = {
      [EnrootType.DEPOSIT]: [],
      [EnrootType.DEPOSITS]: [],
    };

    [...EnrootStrategy.sdk.tokens.unripeTokens].forEach((urToken) => {
      const crates = this._params.crates[urToken.address];
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
    const { beanstalk } = EnrootStrategy.sdk.contracts;
    const gasEstimate = await beanstalk.estimateGas.farm(
      Object.values(this._getCallData()).reduce<string[]>(
        (prev, curr) => [...prev, ...curr],
        []
      )
    );
    console.debug(`[EnrootStrategy][estimateGas]: `, gasEstimate.toString());

    return gasEstimate;
  }

  getSteps() {
    const { beanstalk } = EnrootStrategy.sdk.contracts;
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

    const _steps = { steps: EnrootStrategy.normaliseSteps(steps) };
    console.debug(`[EnrootStrategy][getSteps]: `, _steps);

    return _steps;
  }

  /// EnrootStrategy specific utils
  static pickCrates(
    balances: TokenMap<FarmerSiloBalance>,
    getBDV: (token: Token) => BigNumber
  ) {
    const unripe = [...EnrootStrategy.sdk.tokens.unripeTokens];
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
