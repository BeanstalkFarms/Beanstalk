import { BigInt } from "@graphprotocol/graph-ts";
import { Deposit, Withdraw } from "../../generated/schema";
import { BEAN_ERC20, WETH } from "../../../subgraph-core/utils/Constants";
import { handleAddLiquidity, handleRemoveLiquidity, handleRemoveLiquidityOneToken, handleSync } from "../../src/WellHandler";
import { BEAN_SWAP_AMOUNT, SWAP_ACCOUNT, WELL, WELL_LP_AMOUNT, WETH_SWAP_AMOUNT } from "./Constants";
import { createContractCallMocks } from "./Functions";
import { createAddLiquidityEvent, createRemoveLiquidityEvent, createRemoveLiquidityOneTokenEvent, createSyncEvent } from "./Well";

export function mockAddLiquidity(tokenAmounts: BigInt[] = [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT]): string {
  createContractCallMocks();
  let newEvent = createAddLiquidityEvent(WELL, SWAP_ACCOUNT, WELL_LP_AMOUNT, tokenAmounts);
  handleAddLiquidity(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function mockRemoveLiquidity(tokenAmounts: BigInt[] = [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT]): string {
  createContractCallMocks();
  let newEvent = createRemoveLiquidityEvent(WELL, SWAP_ACCOUNT, WELL_LP_AMOUNT, tokenAmounts);
  handleRemoveLiquidity(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function mockRemoveLiquidityOneBean(): string {
  createContractCallMocks();
  let newEvent = createRemoveLiquidityOneTokenEvent(WELL, SWAP_ACCOUNT, WELL_LP_AMOUNT, BEAN_ERC20, BEAN_SWAP_AMOUNT);
  handleRemoveLiquidityOneToken(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function mockRemoveLiquidityOneWeth(): string {
  createContractCallMocks();
  let newEvent = createRemoveLiquidityOneTokenEvent(WELL, SWAP_ACCOUNT, WELL_LP_AMOUNT, WETH, WETH_SWAP_AMOUNT);
  handleRemoveLiquidityOneToken(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function mockSync(newReserves: BigInt[], lpAmountOut: BigInt): string {
  createContractCallMocks();
  let newSyncEvent = createSyncEvent(WELL, SWAP_ACCOUNT, newReserves, lpAmountOut);
  handleSync(newSyncEvent);
  return newSyncEvent.transaction.hash.toHexString() + "-" + newSyncEvent.logIndex.toString();
}

export function loadDeposit(id: string): Deposit {
  return Deposit.load(id) as Deposit;
}

export function loadWithdraw(id: string): Withdraw {
  return Withdraw.load(id) as Withdraw;
}
