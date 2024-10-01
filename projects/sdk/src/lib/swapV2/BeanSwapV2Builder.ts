import { TokenValue } from "@beanstalk/sdk-core";
import { BeanstalkSDK } from "../BeanstalkSDK";
import { BeanSwapV2 } from "./BeanSwapV2";
import { ERC20Token } from "src/classes/Token";
import { AdvancedFarmCallStruct } from "src/constants/generated/protocol/abi/Beanstalk";
import { FarmFromMode, FarmToMode } from "../farm";
import { BeanSwapV2QuoterResult } from "./types";
import { AdvancedPipeCallStruct } from "src/lib/depot";
import { SwapV2Node, SwapV2WellNode, ZeroXSwapNode } from "./SwapV2Node";
import { StepGenerator } from "src/classes/Workflow";
import { AdvancedPipePreparedResult } from "../depot/pipe";

export class BeanSwapV2Builder {
  static sdk: BeanstalkSDK;

  swapV2: BeanSwapV2;

  constructor(sdk: BeanstalkSDK, swapV2: BeanSwapV2) {
    BeanSwapV2Builder.sdk = sdk;
    this.swapV2 = swapV2;
  }

  build(
    quoteResults: BeanSwapV2QuoterResult,
    caller: string,
    recipient: string,
    fromMode: FarmFromMode,
    toMode: FarmToMode
  ) {
    if (!quoteResults.path.length) {
      throw new Error("Unable to build quotes. No paths found.");
    }

    const firstQuote = quoteResults.path[0];

    const inputToken = firstQuote.sellToken;
    const pipeline = BeanSwapV2Builder.sdk.contracts.pipeline;

    const advancedFarm = BeanSwapV2Builder.sdk.farm.createAdvancedFarm(`BeanSwapV2-farm`);
    const advPipeCalls = BeanSwapV2Builder.sdk.farm.createAdvancedPipe("BeanSwapV2-pipe");

    const transferToPipeline = new BeanSwapV2Builder.sdk.farm.actions.TransferToken(
      inputToken.address,
      pipeline.address, // always transfer to pipeline
      fromMode,
      FarmToMode.EXTERNAL // always transfer to external
    );

    if (caller.toLowerCase() !== pipeline.address.toLowerCase()) {
      advancedFarm.add(transferToPipeline);
    }

    for (const [i, quote] of quoteResults.path.entries()) {
      const node = quote.node;

      if (this.isWellNode(node) || this.isZeroXNode(node)) {
        advPipeCalls.add(
          node.buildPipelineApprovalStepFromQuote(quote, TokenValue.MAX_UINT256.toBigNumber())
        );

        let copySlot: number | undefined;
        if (i !== 0) {
          copySlot = quoteResults.path[i - 1].node.amountOutCopySlot;
        }

        advPipeCalls.add(quote.node.buildFromQuote(quote, copySlot), { tag: quote.tag });
      }
    }

    this.getTransferToRecipientSteps(quoteResults, recipient, toMode).forEach((step) =>
      advPipeCalls.add(step)
    );

    advancedFarm.add(advPipeCalls);

    return advancedFarm;
  }

  isWellNode(node: SwapV2Node): node is SwapV2WellNode {
    return node instanceof SwapV2WellNode;
  }

  isZeroXNode(node: SwapV2Node): node is ZeroXSwapNode {
    return node instanceof ZeroXSwapNode;
  }

  private getTransferToRecipientSteps(
    quoteResults: BeanSwapV2QuoterResult,
    recipient: string,
    toMode: FarmToMode
  ) {
    if (
      recipient.toLowerCase() === BeanSwapV2Builder.sdk.contracts.pipeline.address.toLowerCase()
    ) {
      return [];
    }

    const lastQuote = quoteResults.path[quoteResults.path.length - 1];
    const outputToken = lastQuote.buyToken;

    // should never happen
    if (!lastQuote) {
      throw new Error("Unable to finalize quotes. No paths found.");
    }

    const lastActionClipboard = {
      tag: lastQuote.tag,
      copySlot: lastQuote.node.amountOutCopySlot
    };

    const approveBeanstalkClipboard = {
      ...lastActionClipboard,
      pasteSlot: 1
    };

    const transferToRecipientClipboard = {
      ...lastActionClipboard,
      pasteSlot: 2
    };

    const approveBack = new BeanSwapV2Builder.sdk.farm.actions.ApproveERC20(
      outputToken,
      BeanSwapV2Builder.sdk.contracts.beanstalk.address,
      approveBeanstalkClipboard
    );

    const transferToRecipient = new BeanSwapV2Builder.sdk.farm.actions.TransferToken(
      outputToken.address,
      recipient, // transfer to recipient
      FarmFromMode.EXTERNAL,
      toMode, // transfer desired toMode
      transferToRecipientClipboard
    );

    return [approveBack, transferToRecipient];
  }

  // beanstalkTransfer(
  //   token: ERC20Token,
  //   amountIn: TokenValue,
  //   recipient: string,
  //   fromMode: FarmFromMode,
  //   toMode: FarmToMode,
  //   clipboard: string
  // ): AdvancedFarmCallStruct {
  //   const beanstalk = BeanSwapV2Builder.sdk.contracts.beanstalk;

  //   return {
  //     target: beanstalk.address,
  //     callData: beanstalk.interface.encodeFunctionData("transferToken", [
  //       token.address,
  //       amountIn,
  //       recipient,
  //       fromMode,
  //       toMode
  //     ])
  //   };
  // }
}
