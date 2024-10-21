
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { StepClass } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "src/lib/depot/pipe";
import { FarmFromMode, FarmToMode } from "src/lib/farm";
import { ERC20Token, NativeToken } from "src/classes/Token";
import { SwapNode,  ISwapNodeSettable } from "./SwapNode";
import { ClipboardSettings } from "src/types";
import { isNativeToken } from "src/utils/token";

/**
 * Abstract class to extend for actions involving ETH, specifically, wrapETH & unwrapETH.
 * we declare the sellToken & buyToken as readonly to ensure they are never changed
 */
export abstract class NativeSwapNode extends SwapNode {
  abstract readonly sellToken: NativeToken | ERC20Token;

  abstract readonly buyToken: NativeToken | ERC20Token;

  override setFields<T extends ISwapNodeSettable>(args: Partial<T>) {
    const amount = args.sellAmount ?? args.buyAmount;
    if (amount) {
      this.sellAmount = amount;
      this.buyAmount = amount;
    }
    return this;
  }


  protected validateIsNativeToken(token: ERC20Token | NativeToken) {
    if (!(isNativeToken(token))) {
      throw this.makeErrorWithContext(`Expected Native token but got ${token.symbol}.`);
    }
  }
}

interface UnwrapEthBuildParams {
  fromMode: FarmFromMode;
  copySlot: number | undefined;
}

/**
 * Class to faciliate unwrapping WETH -> ETH
 */
export class UnwrapEthSwapNode extends NativeSwapNode {
  readonly name = "SwapNode: UnwrapEth";

  readonly sellToken: ERC20Token;

  readonly buyToken: NativeToken;

  readonly allowanceTarget: string;

  constructor(sdk: BeanstalkSDK) {
    super(sdk);
    this.sellToken = sdk.tokens.WETH;
    this.buyToken = sdk.tokens.ETH;
    this.allowanceTarget = sdk.contracts.beanstalk.address;
  }

  buildStep({ fromMode, copySlot }: UnwrapEthBuildParams): StepClass<AdvancedPipePreparedResult> {
    this.validateSellAmount();
    this.validateBuyAmount();

    let clipboard: ClipboardSettings | undefined;

    if (copySlot !== undefined) {
      clipboard = {
        tag: this.returnIndexTag,
        copySlot,
        pasteSlot: 0
      };
    }

    return new UnwrapEthSwapNode.sdk.farm.actions.UnwrapEth(fromMode, clipboard);
  }
}


interface WrapEthBuildParams {
  toMode: FarmToMode;
}

/**
 * Class to faciliate wrapping ETH -> WETH
 */
export class WrapEthSwapNode extends NativeSwapNode {
  readonly name = "SwapNode: WrapEth";

  readonly sellToken: NativeToken;

  readonly buyToken: ERC20Token;

  readonly allowanceTarget: string;

  constructor(sdk: BeanstalkSDK) {
    super(sdk);
    this.sellToken = sdk.tokens.ETH;
    this.buyToken = sdk.tokens.WETH;
    this.allowanceTarget = sdk.contracts.beanstalk.address;
  }

  buildStep({ toMode }: WrapEthBuildParams): StepClass<AdvancedPipePreparedResult> {
    this.validateSellAmount();
    this.validateBuyAmount();

    return new WrapEthSwapNode.sdk.farm.actions.WrapEth(toMode);
  }
}
