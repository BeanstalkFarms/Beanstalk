import { TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { MinimumViableSwapQuote } from "src/lib/matcha";
import { AdvancedPipeCallStruct, Clipboard } from "src/lib/depot";
import { ERC20Token } from "src/classes/Token";
import { ethers } from "ethers";
import { BasinWell } from "src/classes/Pool/BasinWell";

export class PipelineConvert {
  static sdk: BeanstalkSDK;

  constructor(sdk: BeanstalkSDK) {
    PipelineConvert.sdk = sdk;
  }

  /**
   * Equal2Equal
   * - remove in equal parts from Well 1
   * - swap non-bean token of well 1 for non-bean token of well 2
   * - add in equal parts to well 2
   * Builds the advanced pipe calls for the pipeline convert
   * @param quote
   */
  public buildEq2EqAdvancedPipeCalls(
    from: {
      well: BasinWell;
      amountIn: TokenValue;
      amountsOut: TokenValue[];
    },
    swap: {
      buyToken: ERC20Token;
      sellToken: ERC20Token;
      quote: MinimumViableSwapQuote;
    },
    to: {
      well: BasinWell;
      amountOut: TokenValue;
    }
  ) {
    const sellTokenIndex = from.well.tokens.findIndex(
      (t) => t.address.toLowerCase() === swap.sellToken.address.toLowerCase()
    );

    const pipe: AdvancedPipeCallStruct[] = [];

    // 0: approve from.well.lpToken to use from.well.lpToken
    pipe.push(PipelineConvert.snippets.erc20Approve(from.well.lpToken, from.well.lpToken.address));

    // 1: remove liquidity from from.well
    pipe.push(
      PipelineConvert.snippets.removeLiquidity(
        from.well,
        from.amountIn,
        [TokenValue.ZERO, TokenValue.ZERO],
        from.well.lpToken.address
      )
    );

    // 2: Approve swap contract to spend sellToken
    pipe.push(PipelineConvert.snippets.erc20Approve(swap.sellToken, swap.quote.allowanceTarget));

    // 3: Swap non-bean token of well 1 for non-bean token of well 2
    pipe.push({
      target: swap.quote.to,
      callData: swap.quote.data,
      clipboard: Clipboard.encode([])
    });

    // 4: transfer BuyToken to to.well
    pipe.push(
      PipelineConvert.snippets.erc20Transfer(
        swap.buyToken,
        to.well.address,
        to.amountOut,
        Clipboard.encodeSlot(3, 0, 1)
      )
    );

    // 5: transfer from.well.tokens[0] to to.well
    pipe.push(
      PipelineConvert.snippets.erc20Transfer(
        from.well.tokens[sellTokenIndex === 1 ? 0 : 1],
        to.well.address,
        TokenValue.MAX_UINT256, // set to max uint256 to ensure transfer succeeds
        Clipboard.encodeSlot(1, 2, 1)
      )
    );

    // 6. Call Sync on to.well
    pipe.push(
      PipelineConvert.snippets.wellSync(
        to.well,
        PipelineConvert.sdk.contracts.pipeline.address, // set recipient to pipeline
        to.amountOut
      )
    );
  }

  private static snippets = {
    erc20Approve: function (
      token: ERC20Token,
      spender: string,
      amount: TokenValue = TokenValue.MAX_UINT256,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct {
      return {
        target: token.address,
        callData: token
          .getContract()
          .interface.encodeFunctionData("approve", [spender, amount.toBigNumber()]),
        clipboard
      };
    },
    erc20Transfer: function (
      token: ERC20Token,
      recipient: string,
      amount: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct {
      return {
        target: token.address,
        callData: token
          .getContract()
          .interface.encodeFunctionData("transfer", [recipient, amount.toBigNumber()]),
        clipboard
      };
    },
    removeLiquidity: function (
      well: BasinWell,
      amountIn: TokenValue,
      minAmountsOut: TokenValue[],
      recipient: string,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct {
      return {
        target: well.address,
        callData: well
          .getContract()
          .interface.encodeFunctionData("removeLiquidity", [
            amountIn.toBigNumber(),
            minAmountsOut.map((a) => a.toBigNumber()),
            recipient,
            ethers.constants.MaxUint256
          ]),
        clipboard: clipboard
      };
    },
    wellSync: function (
      well: BasinWell,
      recipient: string,
      amount: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct {
      return {
        target: well.address,
        callData: well
          .getContract()
          .interface.encodeFunctionData("sync", [recipient, amount.toBigNumber()]),
        clipboard
      };
    },
    gte: function (
      value: TokenValue,
      compareTo: TokenValue,
      clipboard: string = Clipboard.encode([])
    ): AdvancedPipeCallStruct {
      return {
        target: PipelineConvert.sdk.contracts.junction.address,
        // value >= compare
        callData: PipelineConvert.sdk.contracts.junction.interface.encodeFunctionData("gte", [
          value.toBigNumber(),
          compareTo.toBigNumber()
        ]),
        clipboard
      };
    },
    check: function (
      // index of the math or logic operation in the pipe
      index: number
    ): AdvancedPipeCallStruct {
      return {
        target: PipelineConvert.sdk.contracts.junction.address,
        callData: PipelineConvert.sdk.contracts.junction.interface.encodeFunctionData("check", [
          false
        ]),
        clipboard: Clipboard.encodeSlot(index, 0, 0)
      };
    }
  };
}
