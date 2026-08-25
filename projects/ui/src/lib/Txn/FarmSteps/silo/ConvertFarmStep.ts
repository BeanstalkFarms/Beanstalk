import {
  BeanstalkSDK,
  Deposit,
  StepGenerator,
  Token,
  TokenValue,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';
import FarmStep from '~/lib/Txn/Interface/FarmStep';
import type PlantAndDoX from '~/lib/Txn/Interface/PlantAndDoX';

export class ConvertFarmStep extends FarmStep {
  constructor(
    _sdk: BeanstalkSDK,
    private _tokenIn: Token,
    private _tokenOut: Token,
    private _season: number,
    private _deposits: Deposit[]
  ) {
    super(_sdk);
    this._sdk = _sdk;
    this._deposits = _deposits;
  }

  /// this logic exists in the SDK but won't work b/c we need to add plant
  static async _handleConversion(
    sdk: BeanstalkSDK,
    _deposits: Deposit[],
    _tokenIn: Token,
    _tokenOut: Token,
    _amountIn: TokenValue,
    _season: number,
    slippage: number,
    plant?: PlantAndDoX
  ) {
    const { beanstalk } = sdk.contracts;

    const deposits = [..._deposits];

    let amountIn = _amountIn;

    if (plant?.canPrependPlant(_tokenIn)) {
      deposits.push(plant.makePlantCrate());
      amountIn = amountIn.add(plant.getAmount());
    }

    const siloConvert = sdk.silo.siloConvert;

    const conversion = siloConvert.calculateConvert(
      _tokenIn,
      _tokenOut,
      amountIn,
      deposits,
      _season
    );
    console.debug('[ConvertFarmStep][conversion]: ', conversion);

    const stems = conversion.crates.map((c) => c.stem.toString());
    const amounts = conversion.crates.map((c) => c.amount.abs().toBlockchain());
    const isUnripeLpToBean =
      _tokenIn.equals(sdk.tokens.UNRIPE_BEAN_WSTETH) &&
      _tokenOut.equals(sdk.tokens.UNRIPE_BEAN);

    // EBIP-23 moved urLP backing into protected storage. The deployed getter
    // still reads the old storage slot, while convert uses the combined backing.
    const amountOutBN = isUnripeLpToBean
      ? (
          await beanstalk.callStatic.convert(
            siloConvert.calculateEncoding(
              _tokenIn,
              _tokenOut,
              amountIn,
              _tokenOut.amount(0)
            ),
            stems,
            amounts
          )
        ).toAmount
      : await beanstalk.getAmountOut(
          _tokenIn.address,
          _tokenOut.address,
          conversion.amount.toBlockchain()
        );

    const amountOut = _tokenOut.fromBlockchain(amountOutBN);
    const minAmountOut = amountOut.pct(100 - slippage);
    console.debug('[ConvertFarmStep] minAmountOut: ', minAmountOut);

    const getEncoded = () =>
      beanstalk.interface.encodeFunctionData('convert', [
        siloConvert.calculateEncoding(
          _tokenIn,
          _tokenOut,
          amountIn,
          minAmountOut
        ),
        stems,
        amounts,
      ]);

    return {
      conversion,
      minAmountOut,
      getEncoded,
    };
  }

  async handleConversion(
    _amountIn: TokenValue,
    slippage: number,
    plant?: PlantAndDoX
  ) {
    return ConvertFarmStep._handleConversion(
      this._sdk,
      this._deposits,
      this._tokenIn,
      this._tokenOut,
      _amountIn,
      this._season,
      slippage,
      plant
    );
  }

  /**
   *
   * @param callData
   * @param minAmountOut
   *
   * intended for `handleConversion` to be called prior
   * 'callData' & 'minAmountOut'
   */
  build(
    /** */
    getEncoded: () => string,
    /** */
    minAmountOut: TokenValue
  ) {
    this.clear();
    const { beanstalk } = this._sdk.contracts;

    const input: StepGenerator = async (_amountInStep) => ({
      name: 'convert',
      amountOut: ethers.BigNumber.from(minAmountOut.toBlockchain()),
      prepare: () => ({
        target: this._sdk.contracts.beanstalk.address,
        callData: getEncoded(),
      }),
      decode: (data: string) =>
        beanstalk.interface.decodeFunctionData('convert', data),
      decodeResult: (result: string) =>
        beanstalk.interface.decodeFunctionResult('convert', result),
    });

    this.pushInput({ input });

    console.debug(`[ConvertFarmStep][build]: `, this.getFarmInput());

    return this;
  }

  static async getMaxConvert(
    sdk: BeanstalkSDK,
    tokenIn: Token,
    tokenOut: Token
  ) {
    const { beanstalk } = sdk.contracts;

    return beanstalk
      .getMaxAmountIn(tokenIn.address, tokenOut.address)
      .then((amount) => tokenIn.fromBlockchain(amount))
      .catch(() => TokenValue.ZERO); // if calculation fails, consider this pathway unavailable
  }
}
