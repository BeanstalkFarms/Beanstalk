import { TokenValue } from "@beanstalk/sdk-core";
import { ethers } from "ethers";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { Token } from "src/classes/Token";
import { RunContext, RunMode, Step, StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";

export class WellSync extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "wellSync";

  constructor(public _well: BasinWell, public tokenIn: Token, public recipient: string) {
    super();
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext): Promise<Step<AdvancedPipePreparedResult>> {
    const well = await WellSync.sdk.wells.getWell(this._well.address, {});

    const tokenIndex = this._well.tokens.findIndex((token) => token.address.toLowerCase() === this.tokenIn.address.toLowerCase());

    if (tokenIndex === -1) {
      throw new Error("Could not find token in well");
    }

    try {
      await well.getName();
    } catch (err) {}

    const reversed = context.runMode === RunMode.EstimateReversed;

    if (reversed) {
      throw new Error("Reverse direction is not supported by wellSync");
    }

    let amounts: TokenValue[] = []
    for (let i = 0; i < this._well.tokens.length; i++) {
      if (i === tokenIndex) {
        amounts[i] = this.tokenIn.fromBlockchain(_amountInStep);
      } else {
        amounts[i] = TokenValue.ZERO;
      }
    }

    const quote = await well.addLiquidityQuote(amounts);

    return {
      name: this.name,
      amountOut: quote.toBigNumber(),
      value: ethers.BigNumber.from(0),
      prepare: () => {

        const minLP = quote.subSlippage(context.data.slippage || 0.1);

        WellSync.sdk.debug(`>[${this.name}.prepare()]`, {
            well: well.name,
            recipient: this.recipient,
            quoteAmountLessSlippage: minLP,
            method: "sync",
            context
        });

        return {
          target: well.address,
          callData: well.contract.interface.encodeFunctionData("sync", [     
            this.recipient,
            minLP.toBigNumber().toString(),
          ])
        };
      },
      decode: (data: string) => well.contract.interface.decodeFunctionData("sync", data),
      // @ts-ignore
      decodeResult: (data: string) => well.contract.interface.decodeFunctionResult("sync", data)
    };
  }
}
