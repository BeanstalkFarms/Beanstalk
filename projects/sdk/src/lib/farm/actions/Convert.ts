import { BasicPreparedResult, RunContext, Step, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";
import { Token } from "src/classes/Token";
import { Deposit } from "src/lib/silo/types";
import { TokenValue } from "@beanstalk/sdk-core";

export class Convert extends StepClass<BasicPreparedResult> {
  public name: string = "convert";

  constructor(
    private _tokenIn: Token,
    private _tokenOut: Token,
    private _amountIn: TokenValue,
    private _minAmountOut: TokenValue,
    private _deposits: Deposit[],

  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {

    const siloConvert = Convert.sdk.silo.siloConvert;
    
    const amountIn = this._amountIn;
    const minAmountOut = this._minAmountOut;
    const deposits = this._deposits;

    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        Convert.sdk.debug(`[${this.name}.encode()]`, {
          tokenIn:  this._tokenIn,
          tokenOut:  this._tokenOut,
          amountIn: amountIn,
          minAmountOut: minAmountOut,
          deposits: this._deposits,
        });
        return {
          target: Convert.sdk.contracts.beanstalk.address,
          callData: Convert.sdk.contracts.beanstalk.interface.encodeFunctionData("convert", [
            siloConvert.calculateEncoding(
              this._tokenIn,
              this._tokenOut,
              amountIn,
              minAmountOut
            ),
            deposits.map((c) => c.stem.toString()),
            deposits.map((c) => c.amount.abs().toBlockchain())
          ])
        };
      },
      decode: (data: string) => Convert.sdk.contracts.beanstalk.interface.decodeFunctionData("convert", data),
      decodeResult: (result: string) => Convert.sdk.contracts.beanstalk.interface.decodeFunctionResult("convert", result)
    };
  }
}
