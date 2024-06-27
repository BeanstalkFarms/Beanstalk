import { BasicPreparedResult, RunContext, StepClass } from "src/classes/Workflow";
import { ethers } from "ethers";
import { Token } from "src/classes/Token";
import { TokenValue } from "@beanstalk/sdk-core";

export class Mow extends StepClass<BasicPreparedResult> {
  public name: string = "mow";

  constructor(
    private _account: string,
    private _tokensToMow: Map<Token, TokenValue>
  ) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext) {

    const tokensToMow: string[] = [];

    this._tokensToMow.forEach((grown, token) => {
        if (grown.gt(0)) {
          tokensToMow.push(token.address);
        }
      });

    if (tokensToMow.length === 1) {
        return {
            name: 'mow',
            amountOut: _amountInStep,
            prepare: () => {
                Mow.sdk.debug(`[${this.name}.encode()]`);
                return {
                target: Mow.sdk.contracts.beanstalk.address,
                callData: Mow.sdk.contracts.beanstalk.interface.encodeFunctionData("mow", [
                    this._account,
                    tokensToMow[0]
                ])
                };
            },
            decode: (data: string) => Mow.sdk.contracts.beanstalk.interface.decodeFunctionData("mow", data),
            decodeResult: (result: string) => Mow.sdk.contracts.beanstalk.interface.decodeFunctionResult("mow", result)
        };
    } else {
        return {
            name: 'mowMultiple',
            amountOut: _amountInStep,
            prepare: () => {
                Mow.sdk.debug(`[${this.name}.encode()]`);
                return {
                target: Mow.sdk.contracts.beanstalk.address,
                callData: Mow.sdk.contracts.beanstalk.interface.encodeFunctionData("mowMultiple", [
                    this._account,
                    tokensToMow
                ])
                };
            },
            decode: (data: string) => Mow.sdk.contracts.beanstalk.interface.decodeFunctionData("mowMultiple", data),
            decodeResult: (result: string) => Mow.sdk.contracts.beanstalk.interface.decodeFunctionResult("mowMultiple", result)
        };
    }
  }
}