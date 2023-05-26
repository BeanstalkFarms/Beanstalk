import { ethers } from "ethers";
import { BasicPreparedResult, RunContext, RunMode, StepClass, Workflow } from "src/classes/Workflow";
import { Token } from "src/classes/Token";
import { CurveMetaPool__factory } from "src/constants/generated";
import { FarmFromMode, FarmToMode } from "../types";

export class ExchangeUnderlying extends StepClass<BasicPreparedResult> {
  public name: string = "exchangeUnderlying";

  constructor(
    public readonly pool: string,
    public readonly tokenIn: Token,
    public readonly tokenOut: Token,
    public readonly fromMode: FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    public readonly toMode: FarmToMode = FarmToMode.INTERNAL
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    ExchangeUnderlying.sdk.debug(`>[${this.name}.run()]`, {
      pool: this.pool,
      tokenIn: this.tokenIn.symbol,
      tokenOut: this.tokenOut.symbol,
      amountInStep: _amountInStep,
      fromMode: this.fromMode,
      toMode: this.toMode,
      context
    });
    const [tokenIn, tokenOut] = Workflow.direction(
      this.tokenIn,
      this.tokenOut,
      context.runMode !== RunMode.EstimateReversed // _forward
    );

    const registry = ExchangeUnderlying.sdk.contracts.curve.registries.metaFactory;
    const [i, j] = await registry.get_coin_indices(this.pool, tokenIn.address, tokenOut.address, { gasLimit: 1000000 });

    /// Only MetaPools have the ability to exchange_underlying
    /// FIXME: 3pool also has a single get_dy_underlying method, will we ever use this?
    const amountOut = await CurveMetaPool__factory.connect(this.pool, ExchangeUnderlying.sdk.provider).callStatic[
      "get_dy_underlying(int128,int128,uint256)"
    ](
      i, // i = USDT = coins[3] ([0=BEAN, 1=CRV3] => [0=BEAN, 1=DAI, 2=USDC, 3=USDT])
      j, // j = BEAN = coins[0]
      _amountInStep,
      { gasLimit: 10000000 }
    );

    if (!amountOut) throw new Error("Unexpected missing amountOut");
    // ExchangeUnderlying.sdk.debug(`[${this.name}.run()]: amountout: ${amountOut.toString()}`);

    return {
      name: this.name,
      amountOut,
      // fixme: deprecated ?
      data: {
        pool: this.pool,
        tokenIn: this.tokenIn.address,
        tokenOut: this.tokenOut.address,
        fromMode: this.fromMode,
        toMode: this.toMode
      },
      prepare: () => {
        if (context.data.slippage === undefined) throw new Error("Exchange: slippage required");
        const minAmountOut = Workflow.slip(amountOut!, context.data.slippage);
        ExchangeUnderlying.sdk.debug(`>[${this.name}.prepare()]`, {
          pool: this.pool,
          tokenIn: tokenIn.symbol,
          tokenOut: tokenOut.symbol,
          amountInStep: _amountInStep,
          amountOut,
          minAmountOut,
          fromMode: this.fromMode,
          toMode: this.toMode,
          context
        });
        if (!minAmountOut) throw new Error("ExchangeUnderlying: Missing minAmountOut");
        return {
          target: ExchangeUnderlying.sdk.contracts.beanstalk.address,
          callData: ExchangeUnderlying.sdk.contracts.beanstalk.interface.encodeFunctionData("exchangeUnderlying", [
            this.pool,
            tokenIn.address,
            tokenOut.address,
            _amountInStep,
            minAmountOut,
            this.fromMode,
            this.toMode
          ])
        };
      },
      decode: (data: string) => ExchangeUnderlying.sdk.contracts.beanstalk.interface.decodeFunctionData("exchangeUnderlying", data),
      decodeResult: (result: string) =>
        ExchangeUnderlying.sdk.contracts.beanstalk.interface.decodeFunctionResult("exchangeUnderlying", result)
    };
  }
}
