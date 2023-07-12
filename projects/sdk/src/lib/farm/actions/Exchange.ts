import { ethers } from "ethers";
import { BasicPreparedResult, RunContext, RunMode, Step, StepClass, Workflow } from "src/classes/Workflow";
import { Token } from "src/classes/Token";
import { CurveMetaPool__factory, CurvePlainPool__factory } from "src/constants/generated";
import { FarmFromMode, FarmToMode } from "../types";

export class Exchange extends StepClass implements StepClass<BasicPreparedResult> {
  public name: string = "exchange";

  constructor(
    public readonly pool: string,
    public readonly registry: string,
    public readonly tokenIn: Token,
    public readonly tokenOut: Token,
    public readonly fromMode: FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    public readonly toMode: FarmToMode = FarmToMode.INTERNAL
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    const [tokenIn, tokenOut] = Workflow.direction(
      this.tokenIn,
      this.tokenOut,
      context.runMode !== RunMode.EstimateReversed // _forward
    );

    const registry = Exchange.sdk.contracts.curve.registries[this.registry];
    if (!registry) throw new Error(`Unknown registry: ${this.registry}`);

    const [i, j] = await registry.callStatic.get_coin_indices(this.pool, tokenIn.address, tokenOut.address, {
      gasLimit: 10000000
    });

    /// Get amount out based on the selected pool
    const poolAddr = this.pool.toLowerCase();
    const pools = Exchange.sdk.contracts.curve.pools;
    let amountOut: ethers.BigNumber | undefined;

    if (poolAddr === pools.tricrypto2.address.toLowerCase()) {
      amountOut = await pools.tricrypto2.callStatic.get_dy(i, j, _amountInStep, { gasLimit: 10000000 });
    } else if (poolAddr === pools.pool3.address.toLowerCase()) {
      amountOut = await pools.pool3.callStatic.get_dy(i, j, _amountInStep, { gasLimit: 10000000 });
    } else if (this.registry === Exchange.sdk.contracts.curve.registries.metaFactory.address) {
      amountOut = await CurveMetaPool__factory.connect(this.pool, Exchange.sdk.provider).callStatic["get_dy(int128,int128,uint256)"](
        i,
        j,
        _amountInStep,
        { gasLimit: 10000000 }
      );
    } else if (this.registry === Exchange.sdk.contracts.curve.registries.cryptoFactory.address) {
      amountOut = await CurvePlainPool__factory.connect(this.pool, Exchange.sdk.provider).callStatic.get_dy(i, j, _amountInStep, {
        gasLimit: 10000000
      });
    }

    if (!amountOut) throw new Error("No supported pool found");
    // Exchange.sdk.debug(`[${this.name}.run()]: amountout: ${amountOut.toString()}`);

    return {
      name: this.name,
      amountOut,
      // fixme: deprecated ?
      data: {
        pool: this.pool,
        registry: this.registry,
        tokenIn: tokenIn.address,
        tokenOut: tokenOut.address,
        fromMode: this.fromMode,
        toMode: this.toMode
      },
      prepare: () => {
        if (context.data.slippage === undefined) throw new Error("Exchange: slippage required");
        const minAmountOut = Workflow.slip(amountOut!, context.data.slippage);
        Exchange.sdk.debug(`>[${this.name}.prepare()]`, {
          pool: this.pool,
          registry: this.registry,
          tokenIn: this.tokenIn.symbol,
          tokenOut: this.tokenOut.symbol,
          amountInStep: _amountInStep,
          amountOut,
          minAmountOut,
          fromMode: this.fromMode,
          toMode: this.toMode,
          context
        });
        if (!minAmountOut) throw new Error("Exhange: missing minAmountOut");
        return {
          target: Exchange.sdk.contracts.beanstalk.address,
          callData: Exchange.sdk.contracts.beanstalk.interface.encodeFunctionData("exchange", [
            this.pool,
            this.registry,
            tokenIn.address,
            tokenOut.address,
            _amountInStep,
            minAmountOut,
            this.fromMode,
            this.toMode
          ])
        };
      },
      decode: (data: string) => Exchange.sdk.contracts.beanstalk.interface.decodeFunctionData("exchange", data),
      decodeResult: (result: string) => Exchange.sdk.contracts.beanstalk.interface.decodeFunctionResult("exchange", result)
    };
  }
}
