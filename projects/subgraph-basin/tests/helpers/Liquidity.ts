import { BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Deposit, Withdraw } from "../../generated/schema";
import { BASIN_BLOCK, BEAN_ERC20, WETH } from "../../../subgraph-core/constants/raw/BeanstalkEthConstants";
import { handleAddLiquidity, handleRemoveLiquidity, handleRemoveLiquidityOneToken, handleSync } from "../../src/handlers/WellHandler";
import { BEAN_SWAP_AMOUNT, SWAP_ACCOUNT, WELL, WELL_FUNCTION, WELL_LP_AMOUNT, WETH_SWAP_AMOUNT } from "./Constants";
import { createContractCallMocks } from "./Functions";
import { createAddLiquidityEvent, createRemoveLiquidityEvent, createRemoveLiquidityOneTokenEvent, createSyncEvent } from "./Well";
import { BI_10, deltaBigIntArray, ONE_BD, ZERO_BI } from "../../../subgraph-core/utils/Decimals";
import { mockWellLpTokenUnderlying } from "../../../subgraph-core/tests/event-mocking/Tokens";
import { loadWell } from "../../src/entities/Well";
import { toAddress } from "../../../subgraph-core/utils/Bytes";

export function mockAddLiquidity(
  tokenAmounts: BigInt[] = [BEAN_SWAP_AMOUNT, WETH_SWAP_AMOUNT],
  lpAmount: BigInt = WELL_LP_AMOUNT,
  beanPriceMultiple: BigDecimal = ONE_BD
): string {
  createContractCallMocks(beanPriceMultiple);
  mockCalcLPTokenUnderlying(tokenAmounts, lpAmount);
  let newEvent = createAddLiquidityEvent(WELL, SWAP_ACCOUNT, lpAmount, tokenAmounts);
  newEvent.block.number = BASIN_BLOCK;
  handleAddLiquidity(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function mockSync(newReserves: BigInt[], lpAmount: BigInt = WELL_LP_AMOUNT, beanPriceMultiple: BigDecimal = ONE_BD): string {
  createContractCallMocks(beanPriceMultiple);
  mockCalcLPTokenUnderlying(deltaBigIntArray(newReserves, loadWell(WELL).reserves), lpAmount);
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
  mockCalcLPTokenUnderlying([tokenAmounts[0].neg(), tokenAmounts[1].neg()], lpAmount.neg());
  let newEvent = createRemoveLiquidityEvent(WELL, SWAP_ACCOUNT, lpAmount, tokenAmounts);
  newEvent.block.number = BASIN_BLOCK;
  handleRemoveLiquidity(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function mockRemoveLiquidityOneBean(lpAmount: BigInt = WELL_LP_AMOUNT): string {
  createContractCallMocks();
  mockCalcLPTokenUnderlying([BEAN_SWAP_AMOUNT.neg(), ZERO_BI], lpAmount.neg());
  let newEvent = createRemoveLiquidityOneTokenEvent(WELL, SWAP_ACCOUNT, lpAmount, BEAN_ERC20, BEAN_SWAP_AMOUNT);
  newEvent.block.number = BASIN_BLOCK;
  handleRemoveLiquidityOneToken(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

export function mockRemoveLiquidityOneWeth(lpAmount: BigInt = WELL_LP_AMOUNT, beanPriceMultiple: BigDecimal = ONE_BD): string {
  createContractCallMocks(beanPriceMultiple);
  mockCalcLPTokenUnderlying([ZERO_BI, WETH_SWAP_AMOUNT.neg()], lpAmount.neg());
  let newEvent = createRemoveLiquidityOneTokenEvent(WELL, SWAP_ACCOUNT, lpAmount, WETH, WETH_SWAP_AMOUNT);
  newEvent.block.number = BASIN_BLOCK;
  handleRemoveLiquidityOneToken(newEvent);
  return newEvent.transaction.hash.toHexString() + "-" + newEvent.logIndex.toString();
}

// Proxy to the mockWellLpTokenUnderlying method, adds base well amounts to reserves/lp delta
function mockCalcLPTokenUnderlying(deltaReserves: BigInt[], lpDelta: BigInt): void {
  const well = loadWell(WELL);
  mockWellLpTokenUnderlying(
    toAddress(well.wellFunction),
    lpDelta.abs(),
    [well.reserves[0].plus(deltaReserves[0]), well.reserves[1].plus(deltaReserves[1])],
    well.lpTokenSupply.plus(lpDelta),
    Bytes.empty(),
    [BigInt.fromU32(150).times(BI_10.pow(6)), BigInt.fromU32(5).times(BI_10.pow(15))]
  );
}

export function loadDeposit(id: string): Deposit {
  return Deposit.load(id) as Deposit;
}

export function loadWithdraw(id: string): Withdraw {
  return Withdraw.load(id) as Withdraw;
}
