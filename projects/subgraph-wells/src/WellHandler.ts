import { AddLiquidity, Approval, RemoveLiquidity, RemoveLiquidityOneToken, Swap, Transfer } from "../generated/templates/Well/Well";
import { loadOrCreateAccount } from "./utils/Account";
import { emptyBigIntArray, ZERO_BD, ZERO_BI } from "./utils/Decimals";
import { recordAddLiquidityEvent, recordRemoveLiquidityEvent, recordRemoveLiquidityOneEvent } from "./utils/Liquidity";
import { recordSwapEvent } from "./utils/Swap";
import { getBeanPriceUDSC } from "./utils/Token";
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
  let indexedBalances = emptyBigIntArray(well.tokens.length);

  indexedBalances[well.tokens.indexOf(event.params.tokenOut)] = indexedBalances[well.tokens.indexOf(event.params.tokenOut)].plus(
    event.params.tokenAmountOut
  );

  loadOrCreateAccount(event.transaction.from);

  recordRemoveLiquidityOneEvent(event, indexedBalances);

  // Flip to negative for updating well balances
  for (let i = 0; i < indexedBalances.length; i++) indexedBalances[i] = ZERO_BI.minus(indexedBalances[i]);

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  updateWellTokenBalances(event.address, indexedBalances, event.block.timestamp, event.block.number);

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

export function handleTransfer(event: Transfer): void {}
