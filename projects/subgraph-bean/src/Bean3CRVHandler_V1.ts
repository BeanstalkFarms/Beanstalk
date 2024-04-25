import { BigInt, BigDecimal, Address } from "@graphprotocol/graph-ts";
import {
  AddLiquidity,
  RemoveLiquidity,
  RemoveLiquidityImbalance,
  RemoveLiquidityOne,
  TokenExchange,
  TokenExchangeUnderlying
} from "../generated/Bean3CRV-V1/Bean3CRV";
import { calcLiquidityWeightedBeanPrice, getLastBeanPrice, loadBean, updateBeanSupplyPegPercent, updateBeanValues } from "./utils/Bean";
import { BEAN_ERC20_V1, BEAN_LUSD_V1, BEAN_WETH_V1 } from "../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadOrCreatePool, setPoolReserves, updatePoolPrice, updatePoolValues } from "./utils/Pool";
import { Bean3CRV } from "../generated/Bean3CRV-V1/Bean3CRV";
import { ERC20 } from "../generated/Bean3CRV-V1/ERC20";
import { checkBeanCross } from "./utils/Cross";
import { curveDeltaBUsingVPrice, curvePriceAndLp } from "./utils/price/CurvePrice";
import { manualTwa } from "./utils/price/TwaOracle";
import { externalUpdatePoolPrice as univ2_externalUpdatePoolPrice } from "./UniswapV2Handler";

export function handleTokenExchange(event: TokenExchange): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  handleSwap(
    event.address.toHexString(),
    event.params.sold_id,
    event.params.tokens_sold,
    event.params.bought_id,
    event.params.tokens_bought,
    event.block.timestamp,
    event.block.number
  );
}

export function handleTokenExchangeUnderlying(event: TokenExchangeUnderlying): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  handleSwap(
    event.address.toHexString(),
    event.params.sold_id,
    event.params.tokens_sold,
    event.params.bought_id,
    event.params.tokens_bought,
    event.block.timestamp,
    event.block.number
  );
}

export function handleAddLiquidity(event: AddLiquidity): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.token_amounts[0],
    event.params.token_amounts[1]
  );
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    ZERO_BI.minus(event.params.token_amounts[0]),
    ZERO_BI.minus(event.params.token_amounts[1])
  );
}

export function handleRemoveLiquidityImbalance(event: RemoveLiquidityImbalance): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    ZERO_BI.minus(event.params.token_amounts[0]),
    ZERO_BI.minus(event.params.token_amounts[1])
  );
}

export function handleRemoveLiquidityOne(event: RemoveLiquidityOne): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  if (event.params.provider == BEAN_ERC20_V1) {
    handleLiquidityChange(event.address.toHexString(), event.block.timestamp, event.block.number, event.params.token_amount, ZERO_BI);
  } else {
    handleLiquidityChange(event.address.toHexString(), event.block.timestamp, event.block.number, ZERO_BI, event.params.token_amount);
  }
}

function handleLiquidityChange(
  poolAddress: string,
  timestamp: BigInt,
  blockNumber: BigInt,
  token0Amount: BigInt,
  token1Amount: BigInt
): void {
  let pool = loadOrCreatePool(poolAddress, blockNumber);

  let lpContract = Bean3CRV.bind(Address.fromString(poolAddress));

  let priceAndLp = curvePriceAndLp(Address.fromString(poolAddress));
  let newPoolPrice = priceAndLp[0];
  let lpValue = priceAndLp[1];

  let beanContract = ERC20.bind(BEAN_ERC20_V1);
  let beanHolding = toDecimal(beanContract.balanceOf(Address.fromString(poolAddress)));
  let beanValue = beanHolding.times(newPoolPrice);

  let liquidityUSD = beanValue.plus(lpValue);
  let deltaLiquidityUSD = liquidityUSD.minus(pool.liquidityUSD);

  let volumeUSD =
    deltaLiquidityUSD < ZERO_BD
      ? deltaLiquidityUSD.div(BigDecimal.fromString("2")).times(BigDecimal.fromString("-1"))
      : deltaLiquidityUSD.div(BigDecimal.fromString("2"));
  let volumeBean = BigInt.fromString(volumeUSD.div(newPoolPrice).times(BigDecimal.fromString("1000000")).truncate(0).toString());

  if (token0Amount !== ZERO_BI && token1Amount !== ZERO_BI) {
    volumeUSD = ZERO_BD;
    volumeBean = ZERO_BI;
  }

  let reserveBalances = lpContract.try_get_balances();
  if (!reserveBalances.reverted) {
    setPoolReserves(poolAddress, reserveBalances.value, timestamp, blockNumber);
    if (poolAddress == BEAN_LUSD_V1.toHexString()) {
      manualTwa(poolAddress, reserveBalances.value, timestamp);
    }
  }

  updateBeanSupplyPegPercent(blockNumber);

  let deltaB = curveDeltaBUsingVPrice(Address.fromString(poolAddress), reserveBalances.value[0]);

  updatePricesAndCheckCrosses(poolAddress, newPoolPrice, volumeBean, volumeUSD, deltaLiquidityUSD, deltaB, timestamp, blockNumber);
}

function handleSwap(
  poolAddress: string,
  sold_id: BigInt,
  tokens_sold: BigInt,
  bought_id: BigInt,
  tokens_bought: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  let pool = loadOrCreatePool(poolAddress, blockNumber);

  let lpContract = Bean3CRV.bind(Address.fromString(poolAddress));

  let priceAndLp = curvePriceAndLp(Address.fromString(poolAddress));
  let newPoolPrice = priceAndLp[0];
  let lpValue = priceAndLp[1];

  let beanContract = ERC20.bind(BEAN_ERC20_V1);
  let beanHolding = toDecimal(beanContract.balanceOf(Address.fromString(poolAddress)));
  let beanValue = beanHolding.times(newPoolPrice);

  let liquidityUSD = beanValue.plus(lpValue);
  let deltaLiquidityUSD = liquidityUSD.minus(pool.liquidityUSD);

  let volumeBean = ZERO_BI;
  if (sold_id == ZERO_BI) {
    volumeBean = tokens_sold;
  } else if (bought_id == ZERO_BI) {
    volumeBean = tokens_bought;
  }

  let reserveBalances = lpContract.try_get_balances();
  if (!reserveBalances.reverted) {
    setPoolReserves(poolAddress, reserveBalances.value, timestamp, blockNumber);
    if (poolAddress == BEAN_LUSD_V1.toHexString()) {
      manualTwa(poolAddress, reserveBalances.value, timestamp);
    }
  }

  let deltaB = curveDeltaBUsingVPrice(Address.fromString(poolAddress), reserveBalances.value[0]);

  updateBeanSupplyPegPercent(blockNumber);

  let volumeUSD = toDecimal(volumeBean).times(newPoolPrice);

  updatePricesAndCheckCrosses(poolAddress, newPoolPrice, volumeBean, volumeUSD, deltaLiquidityUSD, deltaB, timestamp, blockNumber);
}

export function updatePricesAndCheckCrosses(
  poolAddress: string,
  newPoolPrice: BigDecimal,
  volumeBean: BigInt,
  volumeUSD: BigDecimal,
  deltaLiquidityUSD: BigDecimal,
  deltaB: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPoolPrice);

  // Update volatile pools (in practice, for pre-replant its beaneth only)
  univ2_externalUpdatePoolPrice(BEAN_WETH_V1, timestamp, blockNumber);

  // Check for bean peg cross
  let oldBeanPrice = getLastBeanPrice(BEAN_ERC20_V1.toHexString());
  const newBeanPrice = calcLiquidityWeightedBeanPrice(BEAN_ERC20_V1.toHexString());
  updateBeanValues(BEAN_ERC20_V1.toHexString(), timestamp, newBeanPrice, ZERO_BI, volumeBean, volumeUSD, deltaLiquidityUSD);
  checkBeanCross(BEAN_ERC20_V1.toHexString(), timestamp, blockNumber, oldBeanPrice, newBeanPrice);
}
