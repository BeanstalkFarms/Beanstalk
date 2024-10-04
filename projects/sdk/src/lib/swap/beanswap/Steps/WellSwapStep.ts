import { BigNumber } from "ethers";
import { TokenValue } from "@beanstalk/sdk-core";
import { BasinWell } from "src/classes/Pool";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { StepFunction, RunContext } from "src/classes/Workflow";
import { Clipboard } from "src/lib/depot";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { Token } from "src/classes/Token";
import { BeanSwapStep, IAmountOutCopySlot } from "./SwapStep";

interface ICopySlot {
  copySlot: number | undefined;
}


// prettier-ignore
export class WellSwapStep extends BeanSwapStep implements IAmountOutCopySlot {

  readonly well: BasinWell;

  readonly amountOutCopySlot = 0;
  
  readonly amountInPasteSlot = 2;

  constructor(sdk: BeanstalkSDK, well: BasinWell) {
    super(sdk);
    this.well = well;
    this.name = `SwapStep: Well ${this.well.name}`;
  }

  get allowanceTarget() {
    return this.well.address;
  }

  async quoteForward(sellToken: Token, buyToken: Token, sellAmount: TokenValue, slippage: number) {
    this.validate.quoteForwardParams(sellToken, buyToken, sellAmount, slippage);

    const contract = this.well.getContract();

    const amountOut = await contract.callStatic
      .getSwapOut(sellToken.address, buyToken.address, sellAmount.toBlockchain())
      .then((result) => buyToken.fromBlockchain(result));

    const buyAmount = amountOut;
    const minBuyAmount = amountOut.subSlippage(slippage)

    this.setFields({ sellToken, buyToken, sellAmount, buyAmount, minBuyAmount, slippage });

    return {
      maxAmountOut: buyAmount,
      minAmountOut: minBuyAmount,
    }
  }
  
  buildStep({ copySlot }: ICopySlot): StepFunction<AdvancedPipePreparedResult> {
    this.validate.all(this.getFields());
    
    return (_amountInStep, runContext) => {
      const returnIndexTag = this.returnIndexTag;
      return {
        name: `wellSwap-${this.sellToken.symbol}-${this.buyToken.symbol}`,
        amountOut: this.minBuyAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => {
          this.sdk.debug(`>[${this.name}].buildStep()`, { 
            well: this.well,
            params: this.getFields(),
            recipient: this.sdk.contracts.pipeline.address,
            copySlot,
          })

          return {
            target: this.well.address,
            callData: this.well.getContract().interface.encodeFunctionData("swapFrom", [
              this.sellToken.address,
              this.buyToken.address,
              this.sellAmount.toBlockchain(),
              this.minBuyAmount.toBlockchain(),
              this.sdk.contracts.pipeline.address,
              TokenValue.MAX_UINT256.toBlockchain()
            ]),
            clipboard: this.getClipboard(runContext, returnIndexTag, copySlot)
          };
        },
        decode: (data: string) => this.well.getContract().interface.decodeFunctionResult("swapFrom", data),
        decodeResult: (data: string) => this.well.getContract().interface.decodeFunctionResult("swapFrom", data)
      }
    }
  }

  private getClipboard(runContext: RunContext, tag: string, copySlot: number | undefined) {
    let clipboard: string = Clipboard.encode([]);

    try {
      if (copySlot !== undefined) {
        const copyIndex = runContext.step.findTag(tag);
        if (copyIndex !== undefined && copyIndex !== null) {
          clipboard = Clipboard.encodeSlot(copyIndex, copySlot, this.amountInPasteSlot);
        }
      }
    } catch (e) {
      this.sdk.debug(
        `[BeanSwapV2Node/getClipboardFromContext]: no clipboard found for ${tag}`
      );
      // do nothing else. We only want to check the existence of the tag
    }

    return clipboard;
  }
}
