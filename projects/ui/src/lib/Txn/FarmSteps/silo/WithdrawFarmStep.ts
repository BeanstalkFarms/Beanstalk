import {
  BeanstalkSDK,
  Deposit,
  FarmToMode,
  ERC20Token,
  Token,
  TokenValue,
  FarmFromMode,
} from '@beanstalk/sdk';
import { FarmStep, PlantAndDoX } from '~/lib/Txn/Interface';

type WithdrawResult = ReturnType<typeof WithdrawFarmStep['calculateWithdraw']>;

export class WithdrawFarmStep extends FarmStep {
  private _withdrawResult: WithdrawResult | undefined;

  constructor(
    _sdk: BeanstalkSDK,
    private _token: ERC20Token,
    private _crates: Deposit[]
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
    toMode: FarmToMode,
    tokenOut?: ERC20Token,
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
    if (!tokenOut && this._token.isLP) {
      throw new Error('Must specify Output Token');
    }

    const removeLiquidity =
      this._token.isLP && tokenOut && !this._token.equals(tokenOut);

    const pool = removeLiquidity
      ? this._sdk.pools.getPoolByLPToken(this._token)
      : undefined;

    const withdrawToMode = removeLiquidity ? FarmToMode.INTERNAL : toMode;

    console.log('removeLIquidity: ', removeLiquidity);

    // FIXME
    const stems = result.crates.map((crate) => crate.stem.toString());
    const amounts = result.crates.map((crate) => crate.amount.blockchainString);

    if (stems.length === 0) {
      throw new Error('Malformatted crates.');
    } else if (stems.length === 1) {
      this.pushInput({
        input: new this._sdk.farm.actions.WithdrawDeposit(
          this._token.address,
          stems[0],
          amounts[0],
          withdrawToMode
        ),
      });
    } else {
      this.pushInput({
        input: new this._sdk.farm.actions.WithdrawDeposits(
          this._token.address,
          stems,
          amounts,
          withdrawToMode
        ),
      });
    }

    if (removeLiquidity && tokenOut && pool) {
      const removeStep = new this._sdk.farm.actions.RemoveLiquidityOneToken(
        pool.address,
        this._sdk.contracts.curve.registries.metaFactory.address,
        tokenOut.address,
        FarmFromMode.INTERNAL_TOLERANT,
        toMode
      );
      this.pushInput({ input: removeStep });
      console.debug('[WithdrawFarmStep][build] removing liquidity', removeStep);
    }
    console.debug('[WithdrawFarmStep][build]: ', this.getFarmInput());

    return this;
  }

  static calculateWithdraw(
    siloWithdraw: BeanstalkSDK['silo']['siloWithdraw'],
    whitelistedToken: Token,
    _crates: Deposit[],
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
