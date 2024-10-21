import { BigDecimal, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { Deposit, Withdraw } from "../../generated/schema";
import { BASIN_BLOCK, BEAN_ERC20, WETH } from "../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { handleAddLiquidity, handleRemoveLiquidity, handleRemoveLiquidityOneToken, handleSync } from "../../src/handlers/WellHandler";
import { BEAN_SWAP_AMOUNT, SWAP_ACCOUNT, WELL, WELL_FUNCTION, WELL_LP_AMOUNT, WETH_SWAP_AMOUNT } from "./Constants";
import { createContractCallMocks } from "./Functions";
import { createAddLiquidityEvent, createRemoveLiquidityEvent, createRemoveLiquidityOneTokenEvent, createSyncEvent } from "./Well";
import { BI_10, subBigIntArray, ONE_BD, ZERO_BI, addBigIntArray } from "../../../subgraph-core/utils/Decimals";
import { mockWellLpTokenUnderlying } from "../../../subgraph-core/tests/event-mocking/Tokens";
import { loadWell } from "../../src/entities/Well";
import { toAddress } from "../../../subgraph-core/utils/Bytes";

export function mockAddLiquidity(
  tokenAmounts: BigInt[] = [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT],
  lpAmount: BigInt = WELL_LP_AMOUNT,
  beanPriceMultiple: BigDecimal = ONE_BD
): string {
  createContractCallMocks(beanPriceMultiple);
  mockCalcLPTokenUnderlying_AddLiq(tokenAmounts, lpAmount);
  let newEvent = createAddLiquidityEvent(WELL, SWAP_ACCOUNT, lpAmount, tokenAmounts);
  newEvent.block.number = BASIN_BLOCK;
  handleAddLiquidity(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function mockSync(newReserves: BigInt[], lpAmount: BigInt = WELL_LP_AMOUNT, beanPriceMultiple: BigDecimal = ONE_BD): string {
  createContractCallMocks(beanPriceMultiple);
  mockCalcLPTokenUnderlying_AddLiq(subBigIntArray(newReserves, loadWell(WELL).reserves), lpAmount);
  let newSyncEvent = createSyncEvent(WELL, SWAP_ACCOUNT, newReserves, lpAmount);
  newSyncEvent.block.number = BASIN_BLOCK;
  handleSync(newSyncEvent);
  return newSyncEvent.transaction.hash.toHexString() + "-" + newSyncEvent.logIndex.toString();
}

export function mockRemoveLiquidity(
  tokenAmounts: BigInt[] = [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT],
  lpAmount: BigInt = WELL_LP_AMOUNT
): string {
  createContractCallMocks();
  mockCalcLPTokenUnderlying_RemoveLiq(lpAmount.neg());
  let newEvent = createRemoveLiquidityEvent(WELL, SWAP_ACCOUNT, lpAmount, tokenAmounts);
  newEvent.block.number = BASIN_BLOCK;
  handleRemoveLiquidity(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function mockRemoveLiquidityOneBean(lpAmount: BigInt = WELL_LP_AMOUNT): string {
  createContractCallMocks();
  mockCalcLPTokenUnderlying_RemoveLiq(lpAmount.neg());
  let newEvent = createRemoveLiquidityOneTokenEvent(WELL, SWAP_ACCOUNT, lpAmount, BEAN_ERC20, BEAN_SWAP_AMOUNT);
  newEvent.block.number = BASIN_BLOCK;
  handleRemoveLiquidityOneToken(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function mockRemoveLiquidityOneWeth(lpAmount: BigInt = WELL_LP_AMOUNT, beanPriceMultiple: BigDecimal = ONE_BD): string {
  createContractCallMocks(beanPriceMultiple);
  mockCalcLPTokenUnderlying_RemoveLiq(lpAmount.neg());
  let newEvent = createRemoveLiquidityOneTokenEvent(WELL, SWAP_ACCOUNT, lpAmount, WETH, WETH_SWAP_AMOUNT);
  newEvent.block.number = BASIN_BLOCK;
  handleRemoveLiquidityOneToken(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

// Proxy to the mockWellLpTokenUnderlying method, adds base well amounts to reserves/lp delta
function mockCalcLPTokenUnderlying_AddLiq(deltaReserves: BigInt[], lpDelta: BigInt): void {
  const well = loadWell(WELL);
  mockWellLpTokenUnderlying(
    toAddress(well.wellFunction),
    lpDelta.abs(),
    addBigIntArray(well.reserves, deltaReserves),
    well.lpTokenSupply.plus(lpDelta),
    Bytes.empty(),
    [BigInt.fromU32(150).times(BI_10.pow(6)), BigInt.fromU32(5).times(BI_10.pow(15))]
  );
}

// Proxy to the mockWellLpTokenUnderlying method, adds base well amounts to reserves/lp delta
function mockCalcLPTokenUnderlying_RemoveLiq(lpDelta: BigInt): void {
  const well = loadWell(WELL);
  mockWellLpTokenUnderlying(toAddress(well.wellFunction), lpDelta.abs(), well.reserves, well.lpTokenSupply, Bytes.empty(), [
    BigInt.fromU32(150).times(BI_10.pow(6)),
    BigInt.fromU32(5).times(BI_10.pow(15))
  ]);
}

export function loadDeposit(id: string): Deposit {
  return Deposit.load(id) as Deposit;
}

export function loadWithdraw(id: string): Withdraw {
  return Withdraw.load(id) as Withdraw;
}
