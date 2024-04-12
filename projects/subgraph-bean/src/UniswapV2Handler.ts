import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Swap, Sync, UniswapV2Pair } from "../generated/BeanUniswapV2Pair/UniswapV2Pair";
import { loadBean, updateBeanSupplyPegPercent, updateBeanValues } from "./utils/Bean";
import { BEAN_ERC20_V1, WETH, WETH_USDC_PAIR } from "../../subgraph-core/utils/Constants";
import { toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import { loadOrCreatePool, setPoolReserves, updatePoolPrice, updatePoolReserves, updatePoolValues } from "./utils/Pool";
import { loadOrCreateToken } from "./utils/Token";
import { checkBeanCross } from "./utils/Cross";
import { Token } from "../generated/schema";
import { uniswapV2DeltaB, uniswapV2Price, uniswapV2Reserves, updatePreReplantPriceETH } from "./utils/Price";

// export function handleMint(event: Mint): void {
//   updatePoolReserves(event.address.toHexString(), event.params.amount0, event.params.amount1, event.block.number);

//   updateBeanSupplyPegPercent(event.block.number);
// }

// export function handleBurn(event: Burn): void {
//   updatePoolReserves(
//     event.address.toHexString(),
//     ZERO_BI.minus(event.params.amount0),
//     ZERO_BI.minus(event.params.amount1),
//     event.block.number
//   );

//   updateBeanSupplyPegPercent(event.block.number);
// }

// Liquidity and cross checks happen on the Sync event handler
export function handleSwap(event: Swap): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  let weth = loadOrCreateToken(WETH.toHexString());

  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);

  let usdVolume = toDecimal(event.params.amount0In.plus(event.params.amount0Out), 18).times(weth.lastPriceUSD);

  // Token 0 is WETH and Token 1 is BEAN

  updatePoolValues(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.amount1In.plus(event.params.amount1Out),
    usdVolume,
    ZERO_BD,
    pool.deltaBeans
  );

  updatePoolReserves(
    event.address.toHexString(),
    event.params.amount0In.minus(event.params.amount0Out),
    event.params.amount1In.minus(event.params.amount1Out),
    event.block.number
  );

  updateBeanSupplyPegPercent(event.block.number);

  updateBeanValues(BEAN_ERC20_V1.toHexString(), event.block.timestamp, pool.lastPrice, ZERO_BI, ZERO_BI, usdVolume, ZERO_BD);
}

// Sync is called in UniswapV2 on any liquidity or swap transaction.
// It updates the `reserves` value on the contract.

export function handleSync(event: Sync): void {
  // Do not index post-exploit data
  if (event.block.number >= BigInt.fromI32(14602790)) return;

  let bean = loadBean(BEAN_ERC20_V1.toHexString());
  let oldBeanPrice = bean.price;

  let reserves = uniswapV2Reserves(event.address);

  // Token 0 is WETH and Token 1 is BEAN

  let weth = updatePreReplantPriceETH();

  let wethBalance = toDecimal(reserves[0], 18);
  let beanBalance = toDecimal(reserves[1]);

  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);
  let startLiquidityUSD = pool.liquidityUSD;
  let endLiquidityUSD = wethBalance.times(weth.lastPriceUSD).times(BigDecimal.fromString("2"));
  let deltaLiquidityUSD = endLiquidityUSD.minus(startLiquidityUSD);
  let deltaBeans = uniswapV2DeltaB(beanBalance, wethBalance, weth.lastPriceUSD);

  updatePoolValues(event.address.toHexString(), event.block.timestamp, event.block.number, ZERO_BI, ZERO_BD, deltaLiquidityUSD, deltaBeans);

  let currentBeanPrice = uniswapV2Price(beanBalance, wethBalance, weth.lastPriceUSD);

  updatePoolPrice(event.address.toHexString(), event.block.timestamp, event.block.number, currentBeanPrice);

  checkBeanCross(BEAN_ERC20_V1.toHexString(), event.block.timestamp, event.block.number, oldBeanPrice, currentBeanPrice);

  setPoolReserves(event.address.toHexString(), reserves, event.block.number);

  updateBeanSupplyPegPercent(event.block.number);

  updateBeanValues(BEAN_ERC20_V1.toHexString(), event.block.timestamp, currentBeanPrice, ZERO_BI, ZERO_BI, ZERO_BD, deltaLiquidityUSD);
}
