import { TokenValue } from "@beanstalk/sdk-core";
import { BigNumberish, ethers } from "ethers";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { Token } from "src/classes/Token";
import { BasicPreparedResult, RunContext, RunMode, Step, StepClass, Workflow } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { deadlineSecondsToBlockchain } from "src/utils";

export class WellAddLiquidity extends StepClass<AdvancedPipePreparedResult> {
  public name: string = "wellAddLiquidity";
  private transactionDeadline: BigNumberish;

  constructor(public _well: BasinWell, public tokenIn: Token, public recipient: string, deadline?: number) {
    super();
    if (deadline !== null && deadline !== undefined && deadline <= 0) {
        throw new Error("Deadline must be greater than 0");
    }
    this.transactionDeadline = deadline ? deadlineSecondsToBlockchain(deadline) : deadlineSecondsToBlockchain(60 * 10);
  }

  async run(_amountInStep: ethers.BigNumber, context: RunContext): Promise<Step<AdvancedPipePreparedResult>> {
    const well = await WellAddLiquidity.sdk.wells.getWell(this._well.address, {});

    const tokenIndex = this._well.tokens.findIndex((token) => token.address.toLowerCase() === this.tokenIn.address.toLowerCase());

    if (!tokenIndex || tokenIndex === -1) {
      throw new Error("Could not find token in well");
    }

    try {
      await well.getName();
    } catch (err) {}

    const reversed = context.runMode === RunMode.EstimateReversed;

    if (reversed) {
      throw new Error("Reverse direction is not supported by wellAddLiquidity");
    }

    let amounts: TokenValue[] = []
    for (let i = 0; i < (well.tokens?.length || 2); i++) {
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
        const amountsIn = amounts.map((tv) => tv.toBlockchain());

        WellAddLiquidity.sdk.debug(`>[${this.name}.prepare()]`, {
            well: well.name,
            amounts: amounts,
            quoteAmountLessSlippage: minLP,
            index: tokenIndex,
            tokenIn: this.tokenIn,
            recipient: this.recipient,
            method: "addLiquidity",
            context
        });

        return {
          target: well.address,
          callData: well.contract.interface.encodeFunctionData("addLiquidity", [
            amountsIn,
            minLP.toBigNumber().toString(),
            this.recipient,
            this.transactionDeadline,
          ])
        };
      },
      decode: (data: string) => well.contract.interface.decodeFunctionData("addLiquidity", data),
      // @ts-ignore
      decodeResult: (data: string) => well.contract.interface.decodeFunctionResult("addLiquidity", data)
    };
  }
}
