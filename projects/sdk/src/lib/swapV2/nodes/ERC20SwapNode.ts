import { BigNumber } from "ethers";
import { ChainResolver, TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { StepFunction, RunContext, StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { ERC20Token } from "src/classes/Token";
import { Clipboard } from "src/lib/depot";
import { BasinWell } from "src/classes/Pool/BasinWell";
import { ZeroX, ZeroXQuoteV2Response } from "src/lib/matcha";
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
    if (this.slippage < 0 || this.slippage > 100) {
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

  protected getClipboard(
    runContext: RunContext,
    tag: string,
    copySlot: number | undefined,
    pasteSlot: number
  ) {
    let clipboard: string = Clipboard.encode([]);

    try {
      if (copySlot !== undefined && copySlot !== null) {
        const copyIndex = runContext.step.findTag(tag);
        if (copyIndex !== undefined && copyIndex !== null) {
          clipboard = Clipboard.encodeSlot(copyIndex, copySlot, pasteSlot);
        }
      }
    } catch (e) {
      WellSwapNode.sdk.debug(
        `[WellSwapNode/getClipboardFromContext]: no clipboard found for ${tag}`
      );
      // do nothing else. We only want to check the existence of the tag
    }

    return clipboard;
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
  }

  async quoteForward(sellAmount: TokenValue, slippage: number) {
    this.setFields({ sellAmount, slippage })
    this.validateQuoteForward();

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
            clipboard: { tag: returnIndexTag, copySlot, pasteSlot: this.amountInPasteSlot }
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
            clipboard: this.getClipboard(runContext, returnIndexTag, copySlot, this.amountInPasteSlot)
          };
        },
        decode: (data: string) => this.well.getContract().interface.decodeFunctionResult("swapFrom", data),
        decodeResult: (data: string) => this.well.getContract().interface.decodeFunctionResult("swapFrom", data)
      }
    }
  }

  override validateTokens() {
    super.validateTokens();
    if (this.well.tokens.length !== 2) {
      throw this.makeErrorWithContext("Cannot configure well swap with non-pair wells");
    }
    if (!this.well.tokens.some((token) => token.equals(this.sellToken))) {
      throw this.makeErrorWithContext(
        `Invalid token Sell Token. Well ${this.well.name} does not contain ${this.sellToken.symbol}`
      );
    }
  }
}

export class ZeroXSwapNode extends ERC20SwapNode {
  name: string = "SwapNode: ZeroX";

  quote: ZeroXQuoteV2Response | undefined;

  readonly amountOutCopySlot: number = 0;

  get allowanceTarget() {
    if (!this.quote?.transaction.to) {
      throw this.makeErrorWithContext("No quote found. Run quoteForward first.");
    }
    return this.quote?.transaction.to || "";
  }

  async quoteForward(sellAmount: TokenValue, slippage: number) {
    this.setFields({ sellAmount, slippage });
    this.validateQuoteForward();
    this.validateTokenIsNotBEAN(this.sellToken);
    this.validateTokenIsNotBEAN(this.buyToken);

    const [quote] = await ZeroXSwapNode.sdk.zeroX.quote({
      chainId: ChainResolver.resolveToMainnetChainId(ZeroXSwapNode.sdk.chainId),
      sellToken: this.sellToken.address,
      buyToken: this.buyToken.address,
      sellAmount: this.sellAmount.toBigNumber().toString(),
      taker: ZeroXSwapNode.sdk.contracts.pipeline.address,
      txOrigin: ZeroXSwapNode.sdk.contracts.pipeline.address,
      sellEntireBalance: true,
      slippageBps: ZeroX.slippageToSlippageBps(this.slippage)
    });

    ZeroXSwapNode.sdk.debug("[ZeroXSwapNode/quoteForward] Quote: ", quote);

    this.quote = quote;
    const buyAmount = this.buyToken.fromBlockchain(quote.buyAmount);
    const minBuyAmount = this.buyToken.fromBlockchain(quote.minBuyAmount);
    this.setFields({ buyAmount, minBuyAmount });
    ZeroXSwapNode.sdk.debug("[ZeroXSwapNode/quoteForward] result: ", this.quote);
    return this;
  }

  buildStep(): StepFunction<AdvancedPipePreparedResult>[] {
    this.validateAll();
    const zeroXQuote = this.quote;
    if (!zeroXQuote) {
      throw this.makeErrorWithContext(
        "Error building zeroX swap: no quote found. Run quoteForward first."
      );
    }

    const swapStruct: StepFunction<AdvancedPipePreparedResult> = (_amountInStep, _) => {
      return {
        name: `${this.name}-${this.sellToken.symbol}-${this.buyToken.symbol}`,
        amountOut: this.minBuyAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => {
          ZeroXSwapNode.sdk.debug(`>[${this.name}.swap].buildStep()`, {
            sellToken: this.sellToken,
            buyToken: this.buyToken,
            sellAmount: this.sellAmount,
            buyAmount: this.buyAmount,
            minBuyAmount: this.minBuyAmount,
            recipient: WellSwapNode.sdk.contracts.pipeline.address,
            target: zeroXQuote.transaction.to
          });
          return {
            target: zeroXQuote.transaction.to,
            callData: zeroXQuote.transaction.data,
            clipboard: Clipboard.encode([])
          };
        },
        decode: () => undefined, // Cannot decode
        decodeResult: () => undefined // Cannot decode
      };
    };

    const balanceOf: StepFunction<AdvancedPipePreparedResult> = (_amountInStep, _) => {
      return {
        name: `${this.name}-${this.sellToken.symbol}-${this.buyToken.symbol}-balanceOfCheck`,
        amountOut: this.sellAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => {
          ZeroXSwapNode.sdk.debug(`>[${this.name}.balanceOf].buildStep()`, {
            token: this.buyToken,
            functionName: "balanceOf",
            balancePublicKey: ZeroXSwapNode.sdk.contracts.pipeline.address
          });
          return {
            target: this.buyToken.address,
            callData: this.buyToken
              .getContract()
              .interface.encodeFunctionData("balanceOf", [
                ZeroXSwapNode.sdk.contracts.pipeline.address
              ]),
            clipboard: Clipboard.encode([])
          };
        },
        decode: (data: string) =>
          this.buyToken.getContract().interface.decodeFunctionResult("balanceOf", data),
        decodeResult: (data: string) =>
          this.buyToken.getContract().interface.decodeFunctionResult("balanceOf", data)
      };
    };

    return [swapStruct, balanceOf];
  }

  private validateTokenIsNotBEAN(token: ERC20Token) {
    if (token.equals(ZeroXSwapNode.sdk.tokens.BEAN)) {
      throw this.makeErrorWithContext(
        "Cannot swap BEAN tokens via 0x. For BEAN quotes, use WELLS instead."
      );
    }
  }
}

interface WellSyncSwapBuildParams {
  recipient: string;
}

export class WellSyncSwapNode extends ERC20SwapNode {
  name: string = "SwapNode: WellSync";

  well: BasinWell;

  readonly sellToken: ERC20Token;

  readonly buyToken: ERC20Token;

  readonly amountOutCopySlot: number = 0;

  readonly transferAmountInPasteSlot = 1;

  readonly allowanceTarget: string;

  constructor(
    sdk: BeanstalkSDK,
    well: BasinWell,
    sellToken: ERC20Token,
    buyToken: ERC20Token = well.lpToken
  ) {
    super(sdk, sellToken, buyToken);
    this.well = well;
    this.allowanceTarget = this.well.address;
  }

  async quoteForward(sellAmount: TokenValue, slippage: number) {
    this.setFields({ sellAmount, slippage });
    this.validateQuoteForward();

    const contract = this.well.getContract();

    const amountsIn = [this.sellAmount, TokenValue.ZERO];

    if (!this.sellToken.equals(this.well.tokens[0])) {
      amountsIn.reverse();
    }

    const buyAmount = await contract.callStatic
      .getAddLiquidityOut(amountsIn.map((amount) => amount.toBlockchain()))
      .then((result) => this.buyToken.fromBlockchain(result));

    const minBuyAmount = buyAmount.subSlippage(this.slippage);

    this.setFields({ buyAmount, minBuyAmount });

    return this;
  }

  buildStep({ recipient }: WellSyncSwapBuildParams): StepClass<AdvancedPipePreparedResult> {
    this.validateAll();
    const sync = new WellSyncSwapNode.sdk.farm.actions.WellSync(
      this.well,
      this.sellToken,
      recipient
    );

    return sync;
  }

  transferStep({ copySlot }: { copySlot: number | undefined }) {
    const transferToken: StepFunction<AdvancedPipePreparedResult> = (_amountInStep, runContext) => {
      const contract = this.sellToken.getContract();

      return {
        name: `transfer-token-${this.sellToken.symbol}-${this.buyToken.symbol}`,
        amountOut: this.sellAmount.toBigNumber(),
        value: BigNumber.from(0),
        prepare: () => {
          return {
            target: this.sellToken.address,
            callData: contract.interface.encodeFunctionData("transfer", [
              this.well.address,
              this.sellAmount.toBlockchain()
            ]),
            clipboard: this.getClipboard(
              runContext,
              this.returnIndexTag,
              copySlot,
              this.transferAmountInPasteSlot
            )
          };
        },
        decode: (data: string) => contract.interface.decodeFunctionData("transfer", data),
        decodeResult: (data: string) => contract.interface.decodeFunctionResult("transfer", data)
      };
    };

    return transferToken;
  }

  override validateTokens() {
    super.validateTokens();
    if (!this.buyToken.equals(this.well.lpToken)) {
      throw this.makeErrorWithContext(
        `WellSyncSwapNode can only swap to the well's LP token, but got ${this.buyToken.symbol}`
      );
    }

    if (!this.well.tokens.some((token) => token.equals(this.sellToken))) {
      throw this.makeErrorWithContext(
        `Invalid Sell Token. Well ${this.well.name} does not contain ${this.sellToken.symbol}`
      );
    }
  }
}
