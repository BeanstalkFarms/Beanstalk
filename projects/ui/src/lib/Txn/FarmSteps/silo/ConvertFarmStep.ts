import {
  BeanstalkSDK,
  StepGenerator,
  Token,
  TokenSiloBalance,
  TokenValue,
} from '@beanstalk/sdk';
import { ethers } from 'ethers';
import { FarmStep, PlantAndDoX } from '~/lib/Txn/Interface';

export class ConvertFarmStep extends FarmStep {
  private _tokenOut: Token;

  constructor(
    _sdk: BeanstalkSDK,
    private _tokenIn: Token,
    private _season: number,
    private _crates: TokenSiloBalance['deposited']['crates']
  ) {
    super(_sdk);
    this._sdk = _sdk;
    this._crates = _crates;

    const path = ConvertFarmStep.getConversionPath(this._sdk, this._tokenIn);

    this._tokenIn = path.tokenIn;
    this._tokenOut = path.tokenOut;
  }

  /// this logic exists in the SDK but won't work b/c we need to add plant
  static async _handleConversion(
    sdk: BeanstalkSDK,
    _crates: TokenSiloBalance['deposited']['crates'],
    _tokenIn: Token,
    _tokenOut: Token,
    _amountIn: TokenValue,
    _season: number,
    slippage: number,
    plant?: PlantAndDoX
  ) {
    const { beanstalk } = sdk.contracts;

    const crates = [..._crates];

    let amountIn = _amountIn;

    if (plant?.canPrependPlant(_tokenIn)) {
      crates.push(plant.makePlantCrate());
      amountIn = amountIn.add(plant.getAmount());
    }

    const siloConvert = sdk.silo.siloConvert;

    const conversion = siloConvert.calculateConvert(
      _tokenIn,
      _tokenOut,
      amountIn,
      crates,
      _season
    );
    console.debug('[ConvertFarmStep][conversion]: ', conversion);

    const amountOutBN = await beanstalk.getAmountOut(
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
        conversion.crates.map((c) => c.season.toString()),
        conversion.crates.map((c) => c.amount.abs().toBlockchain()),
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
      this._crates,
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

  // static methods
  static getConversionPath(sdk: BeanstalkSDK, tokenIn: Token) {
    const siloConvert = sdk.silo.siloConvert;
    const pathMatrix = [
      [siloConvert.Bean, siloConvert.BeanCrv3],
      [siloConvert.urBean, siloConvert.urBeanCrv3],
    ];

    /// b/c siloConvert uses it's own token instances
    const sdkTokenPathMatrix = [
      [sdk.tokens.BEAN, sdk.tokens.BEAN_CRV3_LP],
      [sdk.tokens.UNRIPE_BEAN, sdk.tokens.UNRIPE_BEAN_CRV3],
    ];

    const index = tokenIn.isUnripe ? 1 : 0;
    const path = pathMatrix[index];

    const tokenInIndex = path.findIndex((t) => t.equals(tokenIn));
    const tokenOutIndex = Number(Boolean(!tokenInIndex));

    return {
      path: sdkTokenPathMatrix[index],
      tokenIn: path[tokenInIndex],
      tokenOut: path[tokenOutIndex],
    };
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
