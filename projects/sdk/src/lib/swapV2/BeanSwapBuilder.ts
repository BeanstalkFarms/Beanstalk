import { ERC20Token } from "src/classes/Token";

import { BeanstalkSDK } from "src/lib/BeanstalkSDK";
import { AdvancedFarmWorkflow, FarmFromMode, FarmToMode } from "src/lib/farm";
import { AdvancedPipeWorkflow } from "src/lib/depot";

import {
  ERC20SwapNode,
  SwapNode,
  UnwrapEthSwapNode,
  WellSwapNode,
  WrapEthSwapNode,
  ZeroXSwapNode,
} from "./nodes";
import { TokenValue } from "@beanstalk/sdk-core";
import { TransferTokenNode } from "./nodes/TransferTokenNode";
import { WellSyncSwapNode } from "./nodes/ERC20SwapNode";

class Builder {
  private static sdk: BeanstalkSDK;

  #advPipe: AdvancedPipeWorkflow;

  #advFarm: AdvancedFarmWorkflow;

  #nodes: readonly SwapNode[] = [];

  constructor(sdk: BeanstalkSDK) {
    Builder.sdk = sdk;
    this.#initWorkFlows();
  }

  get advancedFarm() {
    return this.#advFarm;
  }

  get nodes() {
    return this.#nodes as ReadonlyArray<SwapNode>;
  }

  /**
   * Compiles the swapNodes into an advanced farm workflow.
   * @param nodes
   * @param fromMode
   * @param toMode
   * @param caller
   * @param recipient
   *
   * assumes that:
   * - The nodes are in order of execution
   * - The token in the first node is the token to be sold
   * - The token in the last node is the token to be bought
   * - The sellAmount in the first node is the amount to be sold
   * - The buyAmount in the last node is the amount to be bought
   */
  translateNodesToWorkflow(
    nodes: readonly SwapNode[], 
    initFromMode: FarmFromMode, 
    finalToMode: FarmToMode, 
    caller: string, 
    recipient: string
  ) {
    this.#nodes = nodes;

    let fromMode = initFromMode;
    let toMode = finalToMode;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const numNodes = nodes.length;
    const maxIndex = numNodes - 1;

    this.#initWorkFlows(
      `advFarm ${first.sellToken.symbol} -> ${last.buyToken.symbol}`,
      `advPipe ${first.sellToken.symbol} -> ${last.buyToken.symbol}`
    );

    // Handle the case where there is only one action in the swap & it is a wrap or unwrap action.
    if (numNodes === 1) {
      if (isWrapEthNode(first)) {
        this.#advFarm.add(this.#getWrapETH(first, toMode, 0), { tag: first.tag });
        return;
      }
      if (isUnwrapEthNode(first)) {
        this.#advFarm.add(this.#getUnwrapETH(first, fromMode, 0), { tag: first.tag });
        return;
      }
      if (isTransferTokenNode(first)) {
        this.#advFarm.add(
          first.buildStep({ fromMode, toMode, recipient, copySlot: undefined })
        );
        return;
      }
    }

    for (const [i, node] of this.#nodes.entries()) {
      // 1st leg of the swap
      if (i === 0) {
        toMode = FarmToMode.INTERNAL;

        // Wrap ETH before loading pipeline
        if (isWrapEthNode(node)) {
          this.#advFarm.add(this.#getWrapETH(node, toMode, i), { tag: node.tag });
          fromMode = FarmFromMode.INTERNAL_TOLERANT;
        }

        this.#loadPipeline(node, caller, fromMode);

        // go next if wrapETH was the first action.
        if (!isERC20Node(node)) {
          continue;
        }
      }

      // No need to update Farm modes until we offload pipeline.
      if (isERC20Node(node)) {
        let step;
        if (isWellNode(node)) {
          step = node.buildStep({ copySlot: this.#getPrevNodeCopySlot(i) });
        } else if (isZeroXNode(node)) {
          step = node.buildStep();
        } else if (isWellSyncNode(node)) {
          step = node.buildStep({ 
            copySlot: this.#getPrevNodeCopySlot(i),  
            recipient: Builder.sdk.contracts.pipeline.address
          });
        } else {
          throw new Error("Error building swap: Unknown SwapNode type.");
        }

        this.#advPipe.add(this.#getApproveERC20MaxAllowance(node));
        this.#advPipe.add(step, { tag: node.tag });
      }

      // Last leg of swap
      if (i === maxIndex) {
        fromMode = FarmFromMode.EXTERNAL;
        toMode = finalToMode;

        this.#offloadPipeline(node, recipient, fromMode, finalToMode, i);
        this.#advFarm.add(this.#advPipe);

        // // Add UnwrapETH if last action
        if (isUnwrapEthNode(node)) {
          this.#advFarm.add(this.#getUnwrapETH(node, fromMode, i), { tag: node.tag });
        }
      }
    }
  }

  /**
   * Loads pipeline w/ the first ERC20 token in the swap sequence.
   * @param node
   *
   * If the first action is to wrap ETH, we sequence it before loading pipeline. w/ the buyToken.
   * If the caller is pipeline, no need to load tokens.
   */
  #loadPipeline(node: SwapNode, caller: string, from: FarmFromMode) {
    const callerIsPipeline =
      caller.toLowerCase() === Builder.sdk.contracts.pipeline.address.toLowerCase();
    if (!callerIsPipeline) {
      const loadToken = isWrapEthNode(node) ? node.buyToken : (node as ERC20SwapNode).sellToken;

      const transfer = new Builder.sdk.farm.actions.TransferToken(
        loadToken.address,
        Builder.sdk.contracts.pipeline.address,
        from,
        FarmToMode.EXTERNAL
      );

      this.#advFarm.add(transfer);
    }
  }

  /**
   * Adds approve Beanstalk & transferToken to advancedPipe.
   * Transfer to the recipient is conditional on the recipient not being pipeline.
   */
  #offloadPipeline(node: SwapNode, recipient: string, fromMode: FarmFromMode, toMode: FarmToMode, i: number) {
    const recipientIsPipeline =
      recipient.toLowerCase() === Builder.sdk.contracts.pipeline.address.toLowerCase();
    if (recipientIsPipeline) return;

    const outputToken = node.buyToken;
    let copySlot: number | undefined;

    let approveToken: ERC20Token;

    if (isUnwrapEthNode(node)) {
      approveToken = node.sellToken;
      copySlot = this.#getPrevNodeCopySlot(i);
    } else if (isERC20Node(node)) {
      approveToken = node.buyToken;
      copySlot = node.amountOutCopySlot;
    } else {
      throw new Error("Error building swap: Cannot determine approval token for transfer.");
    }

    if (copySlot === undefined) {
      throw new Error("Error building swap: Cannot determine copySlot from previous node.");
    }

    const prevActionClipboard = {
      tag: node.tag,
      copySlot: copySlot
    };

    const approve = new Builder.sdk.farm.actions.ApproveERC20(
      approveToken,
      Builder.sdk.contracts.beanstalk.address,
      { ...prevActionClipboard, pasteSlot: 1 }
    );

    const transfer = new Builder.sdk.farm.actions.TransferToken(
      outputToken.address,
      recipient,
      fromMode,
      toMode,
      { ...prevActionClipboard, pasteSlot: 2 }
    );

    this.#advPipe.add(approve);
    this.#advPipe.add(transfer);
  }

  /**
   *
   */
  #getApproveERC20MaxAllowance(node: SwapNode) {
    if (!isERC20Node(node)) {
      throw new Error("Misconfigured Swap Route. Cannot approve non-ERC20 token.");
    }

    // allow the allowance target to spend max tokens from Pipeline.
    const approve = new Builder.sdk.farm.actions.ApproveERC20(node.sellToken, node.allowanceTarget);
    approve.setAmount(TokenValue.MAX_UINT256);

    return approve;
  }

  // ---------- SwapNode Utils ----------

  /**
   * extracts the unwrapETH step from the node
   * @throws if UnwrapETH is not the last txn
   */
  #getUnwrapETH(node: UnwrapEthSwapNode, fromMode: FarmFromMode, i: number) {
    const isFirst = i === 0;

    // Scenarios where UnwrapETH is allowed:
    const isFirstAndOnly = isFirst && this.#nodes.length === 1;
    const isLast = i === this.#nodes.length - 1;

    if (!isFirstAndOnly && !isLast) {
      throw new Error(
        "Error building swap: UnwrapETH can only be performed as the last txn in a sequnce of swaps."
      );
    }

    const copySlot = this.#getPrevNodeCopySlot(i);

    return node.buildStep({ fromMode, copySlot });
  }

  /**
   * extracts the wrapETH step from the node
   * @throws if WrapETH is not the first txn
   */
  #getWrapETH(node: WrapEthSwapNode, toMode: FarmToMode, i: number) {
    // Ensure that WrapETH can only be added to the workflow as the first txn
    if (i !== 0) {
      throw new Error(
        "Error building swap: WrapETH can only be performed first in a sequnce of txns."
      );
    }

    return node.buildStep({ toMode });
  }

  /**
   * Returns the copySlot of the previous node in the swap sequence.
   */
  #getPrevNodeCopySlot(i: number) {
    if (!this.#nodes.length || i === 0) return undefined;

    const prevNode = this.#nodes[i - 1];
    if (prevNode && isERC20Node(prevNode)) {
      return prevNode.amountOutCopySlot;
    }
    return undefined;
  }

  /// -------------------- Init Utils --------------------

  #initWorkFlows(advFarmName?: string, advPipeName?: string) {
    this.#advFarm = Builder.sdk.farm.createAdvancedFarm(advFarmName);
    this.#advPipe = Builder.sdk.farm.createAdvancedPipe(advPipeName);
    return this;
  }
}

/// -------------------- Node Utils --------------------

const isWrapEthNode = (node: SwapNode): node is WrapEthSwapNode => {
  return node instanceof WrapEthSwapNode;
};
const isUnwrapEthNode = (node: SwapNode): node is UnwrapEthSwapNode => {
  return node instanceof UnwrapEthSwapNode;
};
const isERC20Node = (node: SwapNode): node is ERC20SwapNode => {
  return node instanceof ERC20SwapNode;
};
const isWellNode = (node: SwapNode): node is WellSwapNode => {
  return node instanceof WellSwapNode;
};
const isTransferTokenNode = (node: SwapNode): node is TransferTokenNode => {
  return node instanceof TransferTokenNode;
}
const isZeroXNode = (node: SwapNode): node is ZeroXSwapNode => {
  return node instanceof ZeroXSwapNode;
}
const isWellSyncNode = (node: SwapNode): node is WellSyncSwapNode => {
  return node instanceof WellSyncSwapNode;
}

export { Builder as BeanSwapBuilder };
