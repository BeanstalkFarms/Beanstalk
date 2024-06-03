import { AddLiquidity, RemoveLiquidity, RemoveLiquidityOneToken, Shift, Swap, Sync, Transfer } from "../generated/templates/Well/Well";
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
  updateWellReserves,
  updateWellTokenUSDPrices,
  updateWellVolumesAfterLiquidity,
  updateWellVolumesAfterSwap
} from "./utils/Well";
import { Address, BigInt } from "@graphprotocol/graph-ts";

export function handleAddLiquidity(event: AddLiquidity): void {
  let well = loadWell(event.address);
  loadOrCreateAccount(event.transaction.from);

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  updateWellReserves(event.address, event.params.tokenAmountsIn, event.block.timestamp, event.block.number);

  updateWellTokenUSDPrices(event.address, event.block.number);

  updateWellVolumesAfterLiquidity(
    event.address,
    well.tokens.map<Address>((b) => Address.fromBytes(b)),
    event.params.tokenAmountsIn,
    event.block.timestamp,
    event.block.number
  );

  updateWellLiquidityTokenBalance(event.address, event.params.lpAmountOut, event.block.timestamp, event.block.number);

  incrementWellDeposit(event.address);

  recordAddLiquidityEvent(event);
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  let well = loadWell(event.address);
  loadOrCreateAccount(event.transaction.from);

  // Treat token balances as negative since we are removing liquidity
  let deltaReserves = event.params.tokenAmountsOut;
  for (let i = 0; i < deltaReserves.length; i++) {
    deltaReserves[i] = deltaReserves[i].neg();
  }

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  updateWellReserves(event.address, deltaReserves, event.block.timestamp, event.block.number);

  updateWellTokenUSDPrices(event.address, event.block.number);

  updateWellVolumesAfterLiquidity(
    event.address,
    well.tokens.map<Address>((b) => Address.fromBytes(b)),
    event.params.tokenAmountsOut,
    event.block.timestamp,
    event.block.number
  );

  updateWellLiquidityTokenBalance(event.address, ZERO_BI.minus(event.params.lpAmountIn), event.block.timestamp, event.block.number);

  incrementWellWithdraw(event.address);

  recordRemoveLiquidityEvent(event);
}

export function handleRemoveLiquidityOneToken(event: RemoveLiquidityOneToken): void {
  let well = loadWell(event.address);
  loadOrCreateAccount(event.transaction.from);

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  let withdrawnBalances = emptyBigIntArray(well.tokens.length);
  withdrawnBalances[well.tokens.indexOf(event.params.tokenOut)] = withdrawnBalances[well.tokens.indexOf(event.params.tokenOut)].plus(
    event.params.tokenAmountOut
  );

  updateWellReserves(
    event.address,
    withdrawnBalances.map<BigInt>((b) => b.neg()),
    event.block.timestamp,
    event.block.number
  );

  updateWellTokenUSDPrices(event.address, event.block.number);

  updateWellVolumesAfterLiquidity(
    event.address,
    [event.params.tokenOut],
    [event.params.tokenAmountOut],
    event.block.timestamp,
    event.block.number
  );

  updateWellLiquidityTokenBalance(event.address, ZERO_BI.minus(event.params.lpAmountIn), event.block.timestamp, event.block.number);

  incrementWellWithdraw(event.address);

  recordRemoveLiquidityOneEvent(event, withdrawnBalances);
}

export function handleSwap(event: Swap): void {
  let well = loadWell(event.address);
  loadOrCreateAccount(event.transaction.from);

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  let deltaReserves = emptyBigIntArray(well.tokens.length);
  deltaReserves[well.tokens.indexOf(event.params.fromToken)] = event.params.amountIn;
  deltaReserves[well.tokens.indexOf(event.params.toToken)] = event.params.amountOut.neg();
  updateWellReserves(event.address, deltaReserves, event.block.timestamp, event.block.number);

  updateWellTokenUSDPrices(event.address, event.block.number);

  updateWellVolumesAfterSwap(
    event.address,
    event.params.fromToken,
    event.params.amountIn,
    event.params.toToken,
    event.params.amountOut,
    event.block.timestamp,
    event.block.number
  );

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

  let deltaReserves = deltaBigIntArray(event.params.reserves, well.reserves);
  let amountIn = deltaReserves[fromTokenIndex];

  updateWellReserves(event.address, deltaReserves, event.block.timestamp, event.block.number);

  updateWellTokenUSDPrices(event.address, event.block.number);

  updateWellVolumesAfterSwap(
    event.address,
    fromToken,
    amountIn,
    event.params.toToken,
    event.params.amountOut,
    event.block.timestamp,
    event.block.number
  );

  incrementWellSwap(event.address);

  recordShiftEvent(event, fromToken, amountIn);
}

export function handleSync(event: Sync): void {
  loadOrCreateAccount(event.transaction.from);

  checkForSnapshot(event.address, event.block.timestamp, event.block.number);

  // Since the token(s) in were already transferred before this event was emitted, we need to find the difference to record as the amountIn
  let well = loadWell(event.address);

  let deltaReserves = deltaBigIntArray(event.params.reserves, well.reserves);
  updateWellReserves(event.address, deltaReserves, event.block.timestamp, event.block.number);

  updateWellTokenUSDPrices(event.address, event.block.number);

  updateWellVolumesAfterLiquidity(
    event.address,
    well.tokens.map<Address>((b) => Address.fromBytes(b)),
    deltaReserves,
    event.block.timestamp,
    event.block.number
  );

  updateWellLiquidityTokenBalance(event.address, event.params.lpAmountOut, event.block.timestamp, event.block.number);

  incrementWellDeposit(event.address);

  recordSyncEvent(event, deltaReserves);
}
