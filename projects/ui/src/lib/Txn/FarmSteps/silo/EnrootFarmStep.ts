import { BeanstalkSDK, Token } from '@beanstalk/sdk';
import BigNumber from 'bignumber.js';
import { EstimatesGas, FarmStep } from '~/lib/Txn/Interface';
import {
  LegacyDepositCrate,
  FarmerSiloTokenBalance,
} from '~/state/farmer/silo';
import { TokenMap } from '~/constants';

enum EnrootType {
  DEPOSIT = 'DEPOSIT',
  DEPOSITS = 'DEPOSITS',
}

export class EnrootFarmStep extends FarmStep implements EstimatesGas {

  _crates: Record<string, LegacyDepositCrate[]>

  constructor(
    _sdk: BeanstalkSDK,
    _crates: Record<string, LegacyDepositCrate[]>
  ) {
    super(_sdk);
    this._crates = _crates;
  }

  async estimateGas() {
    const { beanstalk } = this._sdk.contracts;
    const gasEstimate = await beanstalk.estimateGas.farm(
      Object.values(this._getEncoded()).reduce<string[]>(
        (prev, curr) => [...prev, ...curr],
        []
      )
    );
    console.debug(`[EnrootFarmStep][estimateGas]: `, gasEstimate.toString());

    return gasEstimate;
  }

  build() {
    this.clear();

    const { beanstalk } = this._sdk.contracts;

    Object.entries(this._getEncoded()).forEach(([k, callDatas]) => {
      const key = k as EnrootType;
      if (key === EnrootType.DEPOSIT) {
        callDatas.forEach((callData) => {
          this.pushInput({
            input: async (_amountInStep) => ({
              name: 'enrootDeposit',
              amountOut: _amountInStep,
              prepare: () => ({
                target: beanstalk.address,
                callData,
              }),
              decode: (data: string) =>
                beanstalk.interface.decodeFunctionData('enrootDeposit', data),
              decodeResult: (result: string) =>
                beanstalk.interface.decodeFunctionResult(
                  'enrootDeposit',
                  result
                ),
            }),
          });
        });
      } else if (key === EnrootType.DEPOSITS) {
        callDatas.forEach((callData) => {
          this.pushInput({
            input: async (_amountInStep) => ({
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
            }),
          });
        });
      }
    });

    console.debug(`[EnrootFarmStep][build]: `, this.getFarmInput());

    return this;
  }

  /// class specific methods
  private _getEncoded() {
    const { beanstalk } = this._sdk.contracts;

    const callData: { [key in EnrootType]: string[] } = {
      [EnrootType.DEPOSIT]: [],
      [EnrootType.DEPOSITS]: [],
    };

    // REFACTOR: Duplicative of logic in `selectCratesForEnroot`
    [...this._sdk.tokens.unripeTokens].forEach((urToken) => {
      const crates = this._crates[urToken.address];
      if (crates?.length === 1) {
        const encoded = beanstalk.interface.encodeFunctionData(
          'enrootDeposit',
          [
            urToken.address,
            crates[0].stem.toString(),
            urToken.fromHuman(crates[0].amount.toString()).toBlockchain(),
          ]
        );
        callData[EnrootType.DEPOSIT] = [...[EnrootType.DEPOSIT], encoded];
      } else if (crates?.length > 1) {
        const encoded = beanstalk.interface.encodeFunctionData(
          'enrootDeposits',
          [
            urToken.address,
            crates.map((crate) => crate.stem.toString()),
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

  /// static methods
  static pickUnripeCrates(
    unripeTokens: BeanstalkSDK['tokens']['unripeTokens'],
    balances: TokenMap<FarmerSiloTokenBalance>,
    getBDV: (token: Token) => BigNumber
  ) {
    return [...unripeTokens].reduce<TokenMap<LegacyDepositCrate[]>>(
      (prev, token) => {
        const balance = balances[token.address];
        const depositCrates = balance?.deposited.crates;

        prev[token.address] = depositCrates?.filter((crate) => {
          const bdv = getBDV(token).times(crate.amount).toFixed(6, 1);
          return new BigNumber(bdv).gt(crate.bdv);
        });

        return prev;
      },
      {}
    );
  }
}
