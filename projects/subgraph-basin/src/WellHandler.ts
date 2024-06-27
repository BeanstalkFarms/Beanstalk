import {
  AddLiquidity,
  Approval,
  RemoveLiquidity,
  RemoveLiquidityOneToken,
  Shift,
  Swap,
  Sync,
  Transfer
} from "../generated/templates/Well/Well";
import { loadOrCreateAccount } from "./utils/Account";
import { deltaBigIntArray, emptyBigIntArray, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { recordAddLiquidityEvent, recordRemoveLiquidityEvent, recordRemoveLiquidityOneEvent, recordSyncEvent } from "./utils/Liquidity";
import { recordSwapEvent, recordShiftEvent } from "./utils/Swap";
import {
  checkForSnapshot,
  incrementWellDeposit,
  incrementWellSwap,
  incrementWellWithdraw,
  loadWell,
  updateWellLiquidityTokenBalance,
  updateWellTokenBalances,
  updateWellTokenUSDPrices,
  updateWellVolumes
} from "./utils/Well";
import { Address } from "@graphprotocol/graph-ts";

export function handleAddLiquidity(event: AddLiquidity): void {
  loadOrCreateAccount(event.transaction.from);

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  updateWellTokenBalances(event.address, event.params.tokenAmountsIn, event.block.timestamp, event.block.number);

  updateWellLiquidityTokenBalance(event.address, event.params.lpAmountOut, event.block.timestamp, event.block.number);

  updateWellTokenUSDPrices(event.address, event.block.number);

  incrementWellDeposit(event.address);

  recordAddLiquidityEvent(event);
}

export function handleApproval(event: Approval): void {}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  loadOrCreateAccount(event.transaction.from);

  // Treat token balances as negative since we are removing liquidity
  let balances = event.params.tokenAmountsOut;
  for (let i = 0; i < balances.length; i++) balances[i] = ZERO_BI.minus(balances[i]);

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  updateWellTokenBalances(event.address, balances, event.block.timestamp, event.block.number);

  updateWellLiquidityTokenBalance(event.address, ZERO_BI.minus(event.params.lpAmountIn), event.block.timestamp, event.block.number);

  updateWellTokenUSDPrices(event.address, event.block.number);

  incrementWellWithdraw(event.address);

  recordRemoveLiquidityEvent(event);
}

export function handleRemoveLiquidityOneToken(event: RemoveLiquidityOneToken): void {
  // Pre-process amount out into an indexed array for the well's input tokens.

  let well = loadWell(event.address);
  let fromTokenIndex = well.tokens.indexOf(event.params.tokenOut) == 0 ? 1 : 0;

  let indexedBalances = emptyBigIntArray(well.tokens.length);

  indexedBalances[well.tokens.indexOf(event.params.tokenOut)] = indexedBalances[well.tokens.indexOf(event.params.tokenOut)].plus(
    event.params.tokenAmountOut
  );

  loadOrCreateAccount(event.transaction.from);

  recordRemoveLiquidityOneEvent(event, indexedBalances);

  // Flip to negative for updating well balances
  for (let i = 0; i < indexedBalances.length; i++) indexedBalances[i] = ZERO_BI.minus(indexedBalances[i]);

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  updateWellVolumes(
    event.address,
    Address.fromBytes(well.tokens[fromTokenIndex]),
    indexedBalances[fromTokenIndex],
    event.params.tokenOut,
    event.params.tokenAmountOut,
    event.block.timestamp,
    event.block.number
  );

  updateWellLiquidityTokenBalance(event.address, ZERO_BI.minus(event.params.lpAmountIn), event.block.timestamp, event.block.number);

  updateWellTokenUSDPrices(event.address, event.block.number);

  incrementWellWithdraw(event.address);
}

export function handleSwap(event: Swap): void {
  loadOrCreateAccount(event.transaction.from);

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  updateWellVolumes(
    event.address,
    event.params.fromToken,
    event.params.amountIn,
    event.params.toToken,
    event.params.amountOut,
    event.block.timestamp,
    event.block.number
  );

  updateWellTokenUSDPrices(event.address, event.block.number);

  incrementWellSwap(event.address);

  recordSwapEvent(event);
}

export function handleShift(event: Shift): void {
  loadOrCreateAccount(event.transaction.from);
  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  // Since the token in was already transferred before this event was emitted, we need to find the difference to record as the amountIn
  let well = loadWell(event.address);

  let fromTokenIndex = well.tokens.indexOf(event.params.toToken) == 0 ? 1 : 0;
  let fromToken = Address.fromBytes(well.tokens[fromTokenIndex]);

  // Subtract starting reserves from the updated amounts emitted by the event.
  let deltaReserves = deltaBigIntArray(event.params.reserves, well.reserves);
  let amountIn = deltaReserves[fromTokenIndex];

  updateWellVolumes(
    event.address,
    fromToken,
    amountIn,
    event.params.toToken,
    event.params.amountOut,
    event.block.timestamp,
    event.block.number
  );

  updateWellTokenUSDPrices(event.address, event.block.number);

  incrementWellSwap(event.address);

  recordShiftEvent(event, fromToken, amountIn);
}

export function handleSync(event: Sync): void {
  loadOrCreateAccount(event.transaction.from);

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  // Since the token(s) in were already transferred before this event was emitted, we need to find the difference to record as the amountIn
  let well = loadWell(event.address);

  // Subtract starting reserves from the updated amounts emitted by the event.
  let deltaReserves = deltaBigIntArray(event.params.reserves, well.reserves);

  updateWellTokenBalances(event.address, deltaReserves, event.block.timestamp, event.block.number);

  updateWellLiquidityTokenBalance(event.address, event.params.lpAmountOut, event.block.timestamp, event.block.number);

  updateWellTokenUSDPrices(event.address, event.block.number);

  incrementWellDeposit(event.address);

  recordSyncEvent(event, deltaReserves);
}

export function handleTransfer(event: Transfer): void {
  // Placeholder for possible future liquidity holdings data
}
