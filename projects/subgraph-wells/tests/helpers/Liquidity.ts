import { Deposit, Withdraw } from "../../generated/schema";
import { BEAN_ERC20, WETH } from "../../../subgraph-core/utils/Constants";
import { handleAddLiquidity, handleRemoveLiquidity, handleRemoveLiquidityOneToken } from "../../src/WellHandler";
import { BEAN_SWAP_AMOUNT, SWAP_ACCOUNT, WELL, WELL_LP_AMOUNT, WETH_SWAP_AMOUNT } from "./Constants";
import { createContractCallMocks } from "./Functions";
import { createAddLiquidityEvent, createRemoveLiquidityEvent, createRemoveLiquidityOneTokenEvent } from "./Well";

export function createDefaultAddLiquidity(): string {
  createContractCallMocks();
  let newEvent = createAddLiquidityEvent(WELL, SWAP_ACCOUNT, WELL_LP_AMOUNT, [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT]);
  handleAddLiquidity(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function createDefaultRemoveLiquidity(): string {
  createContractCallMocks();
  let newEvent = createRemoveLiquidityEvent(WELL, SWAP_ACCOUNT, WELL_LP_AMOUNT, [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT]);
  handleRemoveLiquidity(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function createRemoveLiquidityOneBean(): string {
  createContractCallMocks();
  let newEvent = createRemoveLiquidityOneTokenEvent(WELL, SWAP_ACCOUNT, WELL_LP_AMOUNT, BEAN_ERC20, BEAN_SWAP_AMOUNT);
  handleRemoveLiquidityOneToken(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function createRemoveLiquidityOneWeth(): string {
  createContractCallMocks();
  let newEvent = createRemoveLiquidityOneTokenEvent(WELL, SWAP_ACCOUNT, WELL_LP_AMOUNT, WETH, WETH_SWAP_AMOUNT);
  handleRemoveLiquidityOneToken(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function loadDeposit(id: string): Deposit {
  return Deposit.load(id) as Deposit;
}

export function loadWithdraw(id: string): Withdraw {
  return Withdraw.load(id) as Withdraw;
}
