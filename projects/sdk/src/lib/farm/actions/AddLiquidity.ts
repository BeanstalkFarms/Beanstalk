import { BigNumber, ethers } from "ethers";
import { BasicPreparedResult, RunContext, Step, StepClass, Workflow } from "src/classes/Workflow";
import { CurveMetaPool__factory, CurvePlainPool__factory } from "src/constants/generated";
import { assert } from "src/utils";
import { FarmFromMode, FarmToMode } from "../types";

export class AddLiquidity extends StepClass<BasicPreparedResult> {
  public name: string = "addLiquidity";

  constructor(
    private _pool: string,
    private _registry: string,
    private _amounts: readonly [number, number] | readonly [number, number, number],
    private _fromMode: FarmFromMode = FarmFromMode.INTERNAL_TOLERANT,
    private _toMode: FarmToMode = FarmToMode.INTERNAL
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext): Promise<Step<BasicPreparedResult>> {
    AddLiquidity.sdk.debug(`[${this.name}.run()]`, {
      pool: this._pool,
      registry: this._registry,
      amounts: this._amounts,
      amountInStep: _amountInStep,
      fromMode: this._fromMode,
      toMode: this._toMode,
      context
    });

    /// [0, 0, 1] => [0, 0, amountIn]
    const amountInStep = this._amounts.map((k) => (k === 1 ? _amountInStep : ethers.BigNumber.from(0)));

    /// Get amount out based on the selected pool
    const poolAddr = this._pool.toLowerCase();
    const pools = AddLiquidity.sdk.contracts.curve.pools;
    let amountOut: BigNumber = ethers.constants.NegativeOne;

    /// Case: tricrypto2
    if (poolAddr === pools.tricrypto2.address.toLowerCase()) {
      assert(amountInStep.length === 3);
      amountOut = await pools.tricrypto2.callStatic.calc_token_amount(
        amountInStep as [any, any, any], // [DAI, USDC, USDT]; assumes that amountInStep is USDT
        true, // _is_deposit
        { gasLimit: 10000000 }
      );
    }

    /// Case: 3Pool
    else if (poolAddr === pools.pool3.address.toLowerCase()) {
      assert(amountInStep.length === 3);
      amountOut = await pools.pool3.callStatic.calc_token_amount(
        amountInStep as [any, any, any],
        true, // _is_deposit
        { gasLimit: 10000000 }
      );
    }

    /// Case: Metapools
    else if (this._registry === AddLiquidity.sdk.contracts.curve.registries.metaFactory.address) {
      assert(amountInStep.length === 2);
      amountOut = await CurveMetaPool__factory.connect(this._pool, AddLiquidity.sdk.provider).callStatic[
        "calc_token_amount(uint256[2],bool)"
      ](
        amountInStep as [any, any],
        true, // _is_deposit
        { gasLimit: 10000000 }
      );
    } else if (this._registry === AddLiquidity.sdk.contracts.curve.registries.cryptoFactory.address) {
      assert(amountInStep.length === 2);
      amountOut = await CurvePlainPool__factory.connect(this._pool, AddLiquidity.sdk.provider).callStatic.calc_token_amount(
        amountInStep as [any, any],
        true, // _is_deposit
        { gasLimit: 10000000 }
      );
    }

    if (amountOut.eq(ethers.constants.NegativeOne)) throw new Error("No supported pool found");
    AddLiquidity.sdk.debug("[step@addLiquidity] finish: ", {
      amountInStep: amountInStep,
      amountOut: amountOut.toString()
    });

    return {
      name: this.name,
      amountOut,
      // fixme: deprecated ?
      // data: {
      //   pool: this._pool,
      //   registry: this._registry,
      //   fromMode: this._fromMode,
      //   toMode: this._toMode
      // },
      prepare: () => {
        const minAmountOut = Workflow.slip(amountOut, context.data.slippage || 0);
        AddLiquidity.sdk.debug(`[${this.name}.prepare()]`, {
          pool: this._pool,
          registry: this._registry,
          amountInStep: _amountInStep,
          minAmountOut,
          fromMode: this._fromMode,
          toMode: this._toMode
        });
        if (!minAmountOut) throw new Error("AddLiquidity: missing minAmountOut");
        return {
          target: AddLiquidity.sdk.contracts.beanstalk.address,
          callData: AddLiquidity.sdk.contracts.beanstalk.interface.encodeFunctionData("addLiquidity", [
            this._pool,
            this._registry,
            amountInStep as any[], // could be 2 or 3 elems
            minAmountOut,
            this._fromMode,
            this._toMode
          ])
        };
      },
      decode: (data: string) => AddLiquidity.sdk.contracts.beanstalk.interface.decodeFunctionData("addLiquidity", data),
      decodeResult: (result: string) => AddLiquidity.sdk.contracts.beanstalk.interface.decodeFunctionResult("addLiquidity", result)
    };
  }
}
