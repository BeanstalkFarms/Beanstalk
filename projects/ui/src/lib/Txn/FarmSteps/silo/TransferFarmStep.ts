import { BeanstalkSDK, Deposit, Token, TokenValue } from '@beanstalk/sdk';
import { FarmStep, PlantAndDoX } from '~/lib/Txn/Interface';
import { WithdrawFarmStep } from '~/lib/Txn/FarmSteps';

type WithdrawResult = ReturnType<typeof WithdrawFarmStep['calculateWithdraw']>;

export class TransferFarmStep extends FarmStep {
  private _withdrawResult: WithdrawResult | undefined;

  constructor(
    _sdk: BeanstalkSDK,
    private _token: Token,
    private _account: string,
    private _crates: Deposit[]
  ) {
    super(_sdk);
    this._token = _token;
    this._account = _account;
    this._crates = _crates;
    this._withdrawResult = undefined;
  }

  get withdrawResult() {
    return this._withdrawResult;
  }

  build(
    toAddress: string,
    // amountIn excluding plant amount
    _amountIn: TokenValue,
    season: number,
    plant?: PlantAndDoX
  ) {
    this.clear();

    const result = WithdrawFarmStep.calculateWithdraw(
      this._sdk.silo.siloWithdraw,
      this._token,
      this._crates,
      _amountIn,
      season,
      plant
    );

    this._withdrawResult = result;

    if (!result || !result.crates.length) {
      throw new Error('Nothing to Withdraw.');
    }

    const stems = result.crates.map((crate) => crate.stem.toString());
    const amounts = result.crates.map((crate) => crate.amount.blockchainString);

    if (stems.length === 0) {
      throw new Error('Malformatted crates');
    } else if (stems.length === 1) {
      const transferDeposit = new this._sdk.farm.actions.TransferDeposit(
        this._account,
        toAddress,
        this._token.address,
        stems[0],
        amounts[0]
      );
      console.debug(
        '[TransferFarmStep/build] strategy: transferDeposit',
        transferDeposit
      );
      this.pushInput({ input: transferDeposit });
    } else {
      const transferDeposits = new this._sdk.farm.actions.TransferDeposits(
        this._account,
        toAddress,
        this._token.address,
        stems,
        amounts
      );
      console.debug(
        '[TransferFarmStep/build] strategy: transferDeposits',
        transferDeposits
      );
      this.pushInput({ input: transferDeposits });
    }

    console.debug('[TransferFarmStep][build]: ', this.getFarmInput());

    return this;
  }
}
