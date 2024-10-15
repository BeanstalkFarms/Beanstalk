import { BigInt, BigDecimal, ethereum, Address } from "@graphprotocol/graph-ts";
import {
  AddLiquidity,
  RemoveLiquidity,
  RemoveLiquidityImbalance,
  RemoveLiquidityOne,
  TokenExchange,
  TokenExchangeUnderlying
} from "../../../generated/Bean-ABIs/Bean3CRV";
import { updateBeanAfterPoolSwap } from "../../utils/Bean";
import { setPoolReserves, updatePoolPrice, updatePoolValues } from "../../utils/Pool";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../../../subgraph-core/utils/Decimals";
import { calcPostSwapValues } from "../../utils/legacy/Curve";

export function handleTokenExchange(event: TokenExchange): void {
  handleSwap(
    event.address,
    event.params.sold_id,
    event.params.tokens_sold,
    event.params.bought_id,
    event.params.tokens_bought,
    event.block
  );
}

export function handleTokenExchangeUnderlying(event: TokenExchangeUnderlying): void {
  handleSwap(
    event.address,
    event.params.sold_id,
    event.params.tokens_sold,
    event.params.bought_id,
    event.params.tokens_bought,
    event.block
  );
}

export function handleAddLiquidity(event: AddLiquidity): void {
  handleLiquidityChange(event.address, event.params.token_amounts[0] !== ZERO_BI && event.params.token_amounts[1] !== ZERO_BI, event.block);
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  handleLiquidityChange(event.address, event.params.token_amounts[0] !== ZERO_BI && event.params.token_amounts[1] !== ZERO_BI, event.block);
}

export function handleRemoveLiquidityImbalance(event: RemoveLiquidityImbalance): void {
  handleLiquidityChange(event.address, event.params.token_amounts[0] !== ZERO_BI && event.params.token_amounts[1] !== ZERO_BI, event.block);
}

export function handleRemoveLiquidityOne(event: RemoveLiquidityOne): void {
  handleLiquidityChange(event.address, false, event.block);
}

function handleLiquidityChange(poolAddress: Address, isBoth: boolean, block: ethereum.Block): void {
  const values = calcPostSwapValues(poolAddress, block);
  if (values == null) {
    return;
  }

  let volumeUSD =
    values.deltaLiquidityUSD < ZERO_BD
      ? values.deltaLiquidityUSD.div(BigDecimal.fromString("2")).times(BigDecimal.fromString("-1"))
      : values.deltaLiquidityUSD.div(BigDecimal.fromString("2"));
  let volumeBean = BigInt.fromString(volumeUSD.div(values.newPoolPrice).times(BigDecimal.fromString("1000000")).truncate(0).toString());

  // Ideally this would constitute volume if both tokens are involved, but not in equal proportion.
  if (isBoth) {
    volumeUSD = ZERO_BD;
    volumeBean = ZERO_BI;
  }

  setPoolReserves(poolAddress, values.reserveBalances, block);
  updatePoolValues(poolAddress, volumeBean, volumeUSD, values.deltaLiquidityUSD, values.deltaB, block);
  updatePoolPrice(poolAddress, values.newPoolPrice, block);

  updateBeanAfterPoolSwap(poolAddress, values.newPoolPrice, volumeBean, volumeUSD, values.deltaLiquidityUSD, block);
}

function handleSwap(
  poolAddress: Address,
  sold_id: BigInt,
  tokens_sold: BigInt,
  bought_id: BigInt,
  tokens_bought: BigInt,
  block: ethereum.Block
): void {
  const values = calcPostSwapValues(poolAddress, block);
  if (values == null) {
    return;
  }

  let volumeBean = ZERO_BI;
  if (sold_id == ZERO_BI) {
    volumeBean = tokens_sold;
  } else if (bought_id == ZERO_BI) {
    volumeBean = tokens_bought;
  }
  let volumeUSD = toDecimal(volumeBean).times(values.newPoolPrice);

  setPoolReserves(poolAddress, values.reserveBalances, block);
  updatePoolValues(poolAddress, volumeBean, volumeUSD, values.deltaLiquidityUSD, values.deltaB, block);
  updatePoolPrice(poolAddress, values.newPoolPrice, block);

  updateBeanAfterPoolSwap(poolAddress, values.newPoolPrice, volumeBean, volumeUSD, values.deltaLiquidityUSD, block);
}
