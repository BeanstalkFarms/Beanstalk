import { Shift, Swap } from "../../generated/templates/Well/Well";
import { Swap as SwapEvent } from "../../generated/schema";
import { Address, BigInt } from "@graphprotocol/graph-ts";

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
  swap.eventType = "SWAP";
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

export function recordShiftEvent(event: Shift, fromToken: Address, amountIn: BigInt): void {
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
  swap.eventType = "SHIFT";
  swap.account = event.transaction.from;
  swap.well = event.address;
  swap.blockNumber = event.block.number;
  swap.timestamp = event.block.timestamp;
  swap.fromToken = fromToken;
  swap.amountIn = amountIn;
  swap.toToken = event.params.toToken;
  swap.amountOut = event.params.amountOut;
  swap.save();
}
