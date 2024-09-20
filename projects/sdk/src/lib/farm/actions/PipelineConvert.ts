import { ethers } from "ethers";
import { BasicPreparedResult, RunContext, StepClass } from "src/classes/Workflow";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { ERC20Token } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";
import { AdvancedPipeCallStruct } from "src/lib/depot";

export class PipelineConvert extends StepClass<BasicPreparedResult> {
  static sdk: BeanstalkSDK;
  public name: string = "pipeline-convert";

  constructor(
    private _tokenIn: ERC20Token,
    public readonly _stems: ethers.BigNumberish[],
    public readonly _amounts: ethers.BigNumberish[],
    private _tokenOut: ERC20Token,
    private _amountIn: TokenValue,
    private _minAmountOut: TokenValue,
    public readonly advancedPipeStructs: AdvancedPipeCallStruct[]
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {
    return {
      name: this.name,
      amountOut: _amountInStep,
      prepare: () => {
        PipelineConvert.sdk.debug(`[${this.name}.encode()]`, {
          tokenIn: this._tokenIn,
          amounts: this._amounts,
          stems: this._stems,
          tokenOut: this._tokenOut,
          amountIn: this._amountIn,
          minAmountOut: this._minAmountOut,
          advancedPipeStructs: this.advancedPipeStructs
        });
        return {
          target: PipelineConvert.sdk.contracts.beanstalk.address,
          callData: PipelineConvert.sdk.contracts.beanstalk.interface.encodeFunctionData(
            "pipelineConvert",
            [
              this._tokenIn.address,
              this._stems,
              this._amounts,
              this._tokenOut.address,
              this.advancedPipeStructs
            ]
          )
        };
      },
      decode: (data: string) =>
        PipelineConvert.sdk.contracts.beanstalk.interface.decodeFunctionData(
          "pipelineConvert",
          data
        ),
      decodeResult: (result: string) =>
        PipelineConvert.sdk.contracts.beanstalk.interface.decodeFunctionResult(
          "pipelineConvert",
          result
        )
    };
  }
}
