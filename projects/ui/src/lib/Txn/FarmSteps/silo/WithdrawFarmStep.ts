import {
  BeanstalkSDK,
  Token,
  TokenSiloBalance,
  TokenValue,
} from '@beanstalk/sdk';
import { FarmStep, PlantAndDoX } from '~/lib/Txn/Interface';

// @REMOVEME
type DepositCrate = TokenSiloBalance['deposited']['crates'][number];

type WithdrawResult = ReturnType<typeof WithdrawFarmStep['calculateWithdraw']>;

export class WithdrawFarmStep extends FarmStep {
  private _withdrawResult: WithdrawResult | undefined;

  constructor(
    _sdk: BeanstalkSDK,
    private _token: Token,
    private _crates: DepositCrate[]
  ) {
    super(_sdk);
    this._token = _token;
    this._withdrawResult = undefined;
  }

  get withdrawResult() {
    return this._withdrawResult;
  }

  build(
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

    console.debug('[WithdrawFarmStep][build] withdrawResult: ', result);

    if (!result || !result.crates.length) {
      throw new Error('Nothing to Withdraw.');
    }

    const seasons = result.crates.map((crate) => crate.season.toString());
    const amounts = result.crates.map((crate) => crate.amount.blockchainString);

    if (seasons.length === 0) {
      throw new Error('Malformatted crates.');
    } else if (seasons.length === 1) {
      this.pushInput({
        input: new this._sdk.farm.actions.WithdrawDeposit(
          this._token.address,
          seasons[0],
          amounts[0]
        ),
      });
    } else {
      this.pushInput({
        input: new this._sdk.farm.actions.WithdrawDeposits(
          this._token.address,
          seasons,
          amounts
        ),
      });
    }

    console.debug('[WithdrawFarmStep][build]: ', this.getFarmInput());

    return this;
  }

  static calculateWithdraw(
    siloWithdraw: BeanstalkSDK['silo']['siloWithdraw'],
    whitelistedToken: Token,
    _crates: DepositCrate[],
    _amountIn: TokenValue,
    season: number,
    plant?: PlantAndDoX
  ) {
    const crates = [..._crates];

    let amountIn = _amountIn;

    if (plant?.canPrependPlant(whitelistedToken)) {
      crates.push(plant.makePlantCrate());
      amountIn = amountIn.add(plant.getAmount());
    }

    const withdrawResult = siloWithdraw.calculateWithdraw(
      whitelistedToken,
      amountIn,
      crates,
      season
    );

    return withdrawResult;
  }
}
