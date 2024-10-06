import { BigNumber } from "ethers";
import { TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { StepFunction, RunContext } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { ERC20Token } from "src/classes/Token";
import { Clipboard } from "src/lib/depot";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { ZeroExQuoteResponse } from "src/lib/matcha";
import { SwapNode, ISwapNode } from "./SwapNode";

interface IERC20SwapNode {
  minBuyAmount: TokenValue;
  slippage: number;
  amountOutCopySlot: number;
}

type IERC20SwapNodeUnion = IERC20SwapNode & ISwapNode;

/**
 * Abstract class for swaps involving only ERC20 tokens.
 *
 * Implements properties & methods that require slippage to be considered.
 */
export abstract class ERC20SwapNode extends SwapNode implements IERC20SwapNode {
  readonly sellToken: ERC20Token;

  readonly buyToken: ERC20Token;

  /**
   * The slippage for the swap occuring via this node
   */
  slippage: number;

  /**
   * The minimum amount of buyToken that should be received after the swap. (buyAmount less slippage)
   */
  minBuyAmount: TokenValue;

  /**
   * The index pointing towards the amount buyAmount receieved at run-time to be copied
   */
  abstract readonly amountOutCopySlot: number;

  constructor(sdk: BeanstalkSDK, sellToken: ERC20Token, buyToken: ERC20Token) {
    super(sdk);
    this.sellToken = sellToken;
    this.buyToken = buyToken;
  }

  /**
   * Quote the amount of buyToken that will be received for selling sellToken
   * @param sellToken
   * @param buyToken
   * @param sellAmount
   * @param slippage
   */
  abstract quoteForward(sellAmount: TokenValue, slippage: number): Promise<this>;

  override setFields<T extends IERC20SwapNodeUnion>(args: Partial<T>) {
    super.setFields(args);
    return this;
  }

  // ------------------------------------------
  // ----- ERC20SwapNode specific methods -----

  private validateSlippage() {
    if (this.slippage === null || this.slippage === undefined) {
      throw this.makeErrorWithContext("Slippage is required");
    }
    if (this.slippage < 0 || this.slippage > 1) {
      throw this.makeErrorWithContext(
        `Expected slippage to be between 0 and 100% but got ${this.slippage}`
      );
    }
    return true;
  }
  private validateMinBuyAmount() {
    if (!this.minBuyAmount) {
      throw this.makeErrorWithContext("minBuyAmount has not been set.");
    }
    if (this.minBuyAmount.lte(0)) {
      throw this.makeErrorWithContext("minBuyAmount must be greater than 0.");
    }
    this.validateBuyAmount();
    if (this.minBuyAmount.gt(this.buyAmount)) {
      throw this.makeErrorWithContext("minBuyAmount must be less than buyAmount.");
    }
    return true;
  }
  protected validateQuoteForward() {
    this.validateTokens();
    this.validateIsERC20Token(this.sellToken);
    this.validateIsERC20Token(this.buyToken);
    this.validateSellAmount();
    this.validateSlippage();
  }
  protected validateAll() {
    this.validateQuoteForward();
    this.validateBuyAmount();
    this.validateMinBuyAmount();
  }
}

interface WellSwapBuildParams {
  copySlot: number | undefined;
}

// prettier-ignore
export class WellSwapNode extends ERC20SwapNode {

  readonly well: BasinWell;

  readonly amountOutCopySlot = 0;
  
  readonly amountInPasteSlot = 2;

  readonly allowanceTarget: string;

  constructor(sdk: BeanstalkSDK, well: BasinWell, sellToken: ERC20Token, buyToken: ERC20Token) {
    super(sdk, sellToken, buyToken);
    this.well = well;
    this.name = `SwapNode: Well ${this.well.name}`;
    this.allowanceTarget = this.well.address;
    this.validateWellHasTokens();
  }

  async quoteForward(sellAmount: TokenValue, slippage: number) {
    this.setFields({ sellAmount, slippage })
    this.validateQuoteForward();
    this.validateWellHasTokens();

    const contract = this.well.getContract();

    const buyAmount = await contract.callStatic
      .getSwapOut(this.sellToken.address, this.buyToken.address, this.sellAmount.toBlockchain())
      .then((result) => this.buyToken.fromBlockchain(result));
    
    const minBuyAmount = buyAmount.subSlippage(this.slippage);
    this.setFields({ buyAmount, minBuyAmount });
    
    WellSwapNode.sdk.debug("[WellSwapNode/quoteForward] result: ", {
      sellToken: this.sellToken,
      buyToken: this.buyToken,
      sellAmount: this.sellAmount,
      slippage: this.slippage,
      buyAmount,
      minBuyAmount,
    });

    return this;
  }
  
  buildStep({ copySlot }: WellSwapBuildParams): StepFunction<AdvancedPipePreparedResult> {
    this.validateAll();
    this.validateWellHasTokens();

    return (_amountInStep, runContext) => {
      const returnIndexTag = this.returnIndexTag;
      return {
        name: `wellSwap-${this.sellToken.symbol}-${this.buyToken.symbol}`,
        amountOut: this.minBuyAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => {
          WellSwapNode.sdk.debug(`>[${this.name}].buildStep()`, { 
            well: this.well,
            sellToken: this.sellToken,
            buyToken: this.buyToken,
            sellAmount: this.sellAmount,
            minBuyAmount: this.minBuyAmount,
            recipient: WellSwapNode.sdk.contracts.pipeline.address,
            copySlot,
          })

          return {
            target: this.well.address,
            callData: this.well.getContract().interface.encodeFunctionData("swapFrom", [
              this.sellToken.address,
              this.buyToken.address,
              this.sellAmount.toBlockchain(),
              this.minBuyAmount.toBlockchain(),
              WellSwapNode.sdk.contracts.pipeline.address,
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
      if (copySlot !== undefined && copySlot !== null) {
        const copyIndex = runContext.step.findTag(tag);
        if (copyIndex !== undefined && copyIndex !== null) {
          clipboard = Clipboard.encodeSlot(copyIndex, copySlot, this.amountInPasteSlot);
        }
      }
    } catch (e) {
      WellSwapNode.sdk.debug(`[WellSwapNode/getClipboardFromContext]: no clipboard found for ${tag}`);
      // do nothing else. We only want to check the existence of the tag
    }

    return clipboard;
  }

  validateWellHasTokens() {
    if (this.well.tokens.length !== 2) {
      throw this.makeErrorWithContext("Cannot configure well swap with non-pair wells");
    }
    const [t0, t1] = this.well.tokens;
    if (!t0.equals(this.sellToken) && !t0.equals(this.sellToken)) {
      throw this.makeErrorWithContext(`Invalid token Sell Token. Well ${this.well.name} does not contain ${this.sellToken.symbol}`);
    }
    if (!t1.equals(this.buyToken) && !t1.equals(this.buyToken)) {
      throw this.makeErrorWithContext(`Invalid token Sell Token. Well ${this.well.name} does not contain ${this.buyToken.symbol}`);
    }

  }
}

export class ZeroXSwapNode extends ERC20SwapNode {
  name: string = "SwapNode: ZeroX";

  quote: ZeroExQuoteResponse | undefined;

  readonly amountOutCopySlot: number = 0;

  get allowanceTarget() {
    return this.quote?.allowanceTarget || "";
  }

  async quoteForward(sellAmount: TokenValue, slippage: number) {
    this.setFields({ sellAmount, slippage });
    this.validateQuoteForward();
    this.validateTokenIsNotBEAN(this.sellToken);
    this.validateTokenIsNotBEAN(this.buyToken);

    const [quote] = await ZeroXSwapNode.sdk.zeroX.quote({
      sellToken: this.sellToken.address,
      buyToken: this.buyToken.address,
      sellAmount: this.sellAmount.toBlockchain(),
      takerAddress: ZeroXSwapNode.sdk.contracts.pipeline.address,
      shouldSellEntireBalance: true,
      skipValidation: true,
      slippagePercentage: (this.slippage / 100).toString()
    });

    ZeroXSwapNode.sdk.debug("[ZeroXSwapNode/quoteForward] Quote: ", quote);

    this.quote = quote;
    const buyAmount = this.buyToken.fromBlockchain(quote.buyAmount);
    this.setFields({ buyAmount, minBuyAmount: buyAmount });
    return this;
  }

  buildStep(): StepFunction<AdvancedPipePreparedResult> {
    this.validateAll();
    const zeroXQuote = this.quote;
    if (!zeroXQuote) {
      throw this.makeErrorWithContext("Error building zeroX swap: no quote found. Run quoteForward first.");
    }
    
    return (_amountInStep, _) => {
      ZeroXSwapNode.sdk.debug(`>[${this.name}].buildStep()`, {
        sellToken: this.sellToken,
        buyToken: this.buyToken,
        sellAmount: this.sellAmount,
        buyAmount: this.buyAmount,
        minBuyAmount: this.minBuyAmount,
        recipient: WellSwapNode.sdk.contracts.pipeline.address,
        target: zeroXQuote.allowanceTarget
      });
      return {
        name: `${this.name}-${this.sellToken.symbol}-${this.buyToken.symbol}`,
        amountOut: this.minBuyAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => ({
          target: zeroXQuote.allowanceTarget,
          callData: zeroXQuote.data,
          clipboard: Clipboard.encode([])
        }),
        decode: () => undefined, // Cannot decode
        decodeResult: () => undefined // Cannot decode
      };
    };
  }

  private validateTokenIsNotBEAN (token: ERC20Token) {
    if (token.equals(ZeroXSwapNode.sdk.tokens.BEAN)) {
      throw this.makeErrorWithContext("Cannot swap BEAN tokens via 0x. For BEAN quotes, use WELLS instead.");
    }
  }
}
