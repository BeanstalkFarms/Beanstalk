import { Swap } from "../../generated/templates/Well/Well";
import { Swap as SwapEvent } from "../../generated/schema";

export function recordSwapEvent(event: Swap): void {
  let swap = new SwapEvent(event.transaction.hash.toHexString() + "-" + event.logIndex.toString());
  let receipt = event.receipt;

  swap.hash = event.transaction.hash;
  swap.nonce = event.transaction.nonce;
  swap.logIndex = event.logIndex.toI32();
  swap.gasLimit = event.transaction.gasLimit;
  if (receipt !== null) {
    swap.gasUsed = receipt.gasUsed;
  }
  swap.gasPrice = event.transaction.gasPrice;
  swap.account = event.transaction.from;
  swap.well = event.address;
  swap.blockNumber = event.block.number;
  swap.timestamp = event.block.timestamp;
  swap.fromToken = event.params.fromToken;
  swap.amountIn = event.params.amountIn;
  swap.toToken = event.params.toToken;
  swap.amountOut = event.params.amountOut;
  swap.save();
}
