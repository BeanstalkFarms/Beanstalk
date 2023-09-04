import { BigInt } from "@graphprotocol/graph-ts";
import { Deposit, Withdraw } from "../../generated/schema";
import { AddLiquidity, RemoveLiquidity, RemoveLiquidityOneToken, Sync } from "../../generated/templates/Well/Well";
import { getBigDecimalArrayTotal } from "../../../subgraph-core/utils/Decimals";
import { getCalculatedReserveUSDValues, loadWell } from "./Well";

export function recordAddLiquidityEvent(event: AddLiquidity): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let deposit = new Deposit(id);
  let receipt = event.receipt;
  let well = loadWell(event.address);

  deposit.hash = event.transaction.hash;
  deposit.nonce = event.transaction.nonce;
  deposit.logIndex = event.logIndex.toI32();
  deposit.gasLimit = event.transaction.gasLimit;
  if (receipt !== null) {
    deposit.gasUsed = receipt.gasUsed;
  }
  deposit.gasPrice = event.transaction.gasPrice;
  deposit.eventType = "ADD_LIQUIDITY";
  deposit.account = event.transaction.from;
  deposit.well = event.address;
  deposit.blockNumber = event.block.number;
  deposit.timestamp = event.block.timestamp;
  deposit.liquidity = event.params.lpAmountOut;
  deposit.tokens = well.tokens;
  deposit.reserves = event.params.tokenAmountsIn;
  deposit.amountUSD = getBigDecimalArrayTotal(getCalculatedReserveUSDValues(well.tokens, event.params.tokenAmountsIn));
  deposit.save();
}

export function recordRemoveLiquidityEvent(event: RemoveLiquidity): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let withdraw = new Withdraw(id);
  let receipt = event.receipt;
  let well = loadWell(event.address);

  withdraw.hash = event.transaction.hash;
  withdraw.nonce = event.transaction.nonce;
  withdraw.logIndex = event.logIndex.toI32();
  withdraw.gasLimit = event.transaction.gasLimit;
  if (receipt !== null) {
    withdraw.gasUsed = receipt.gasUsed;
  }
  withdraw.gasPrice = event.transaction.gasPrice;
  withdraw.eventType = "REMOVE_LIQUIDITY";
  withdraw.account = event.transaction.from;
  withdraw.well = event.address;
  withdraw.blockNumber = event.block.number;
  withdraw.timestamp = event.block.timestamp;
  withdraw.liquidity = event.params.lpAmountIn;
  withdraw.tokens = well.tokens;
  withdraw.reserves = event.params.tokenAmountsOut;
  withdraw.amountUSD = getBigDecimalArrayTotal(getCalculatedReserveUSDValues(well.tokens, event.params.tokenAmountsOut));
  withdraw.save();
}

export function recordRemoveLiquidityOneEvent(event: RemoveLiquidityOneToken, tokenAmounts: BigInt[]): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let withdraw = new Withdraw(id);
  let receipt = event.receipt;
  let well = loadWell(event.address);

  withdraw.hash = event.transaction.hash;
  withdraw.nonce = event.transaction.nonce;
  withdraw.logIndex = event.logIndex.toI32();
  withdraw.gasLimit = event.transaction.gasLimit;
  if (receipt !== null) {
    withdraw.gasUsed = receipt.gasUsed;
  }
  withdraw.gasPrice = event.transaction.gasPrice;
  withdraw.eventType = "REMOVE_LIQUIDITY_ONE_TOKEN";
  withdraw.account = event.transaction.from;
  withdraw.well = event.address;
  withdraw.blockNumber = event.block.number;
  withdraw.timestamp = event.block.timestamp;
  withdraw.liquidity = event.params.lpAmountIn;
  withdraw.tokens = well.tokens;
  withdraw.reserves = tokenAmounts;
  withdraw.amountUSD = getBigDecimalArrayTotal(getCalculatedReserveUSDValues(well.tokens, tokenAmounts));
  withdraw.save();
}

export function recordSyncEvent(event: Sync, deltaReserves: BigInt[]): void {
  let id = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  let deposit = new Deposit(id);
  let receipt = event.receipt;
  let well = loadWell(event.address);

  deposit.hash = event.transaction.hash;
  deposit.nonce = event.transaction.nonce;
  deposit.logIndex = event.logIndex.toI32();
  deposit.gasLimit = event.transaction.gasLimit;
  if (receipt !== null) {
    deposit.gasUsed = receipt.gasUsed;
  }
  deposit.gasPrice = event.transaction.gasPrice;
  deposit.eventType = "SYNC";
  deposit.account = event.transaction.from;
  deposit.well = event.address;
  deposit.blockNumber = event.block.number;
  deposit.timestamp = event.block.timestamp;
  deposit.liquidity = event.params.lpAmountOut;
  deposit.tokens = well.tokens;
  deposit.reserves = deltaReserves;
  deposit.amountUSD = getBigDecimalArrayTotal(getCalculatedReserveUSDValues(well.tokens, deltaReserves));
  deposit.save();
}
