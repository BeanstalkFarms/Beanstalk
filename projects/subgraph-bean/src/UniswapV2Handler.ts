import { BigDecimal, BigInt } from "@graphprotocol/graph-ts";
import { Swap, Sync } from "../generated/BeanUniswapV2Pair/UniswapV2Pair";
import { loadBean, updateBeanSupplyPegPercent, updateBeanValues } from "./utils/Bean";
import { BEAN_ERC20_V1, BEANSTALK, WETH, WETH_USDC_PAIR } from "../../subgraph-core/utils/Constants";
import { BI_10, toDecimal, ZERO_BD, ZERO_BI } from "../../subgraph-core/utils/Decimals";
import {
  loadOrCreatePool,
  loadOrCreatePoolDailySnapshot,
  loadOrCreatePoolHourlySnapshot,
  setPoolReserves,
  updatePoolPrice,
  updatePoolValues
} from "./utils/Pool";
import { loadOrCreateToken } from "./utils/Token";
import { checkBeanCross } from "./utils/Cross";
import { uniswapV2DeltaB, uniswapV2Price, uniswapV2Reserves, updatePreReplantPriceETH } from "./utils/price/UniswapPrice";
import { PreReplant } from "../generated/Beanstalk/PreReplant";
import { getTWAPrices, TWAType } from "./utils/price/TwaOracle";

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

  let newReserves = [
    pool.reserves[0].plus(event.params.amount0In.minus(event.params.amount0Out)),
    pool.reserves[1].plus(event.params.amount1In.minus(event.params.amount1Out))
  ];

  setPoolReserves(event.address.toHexString(), newReserves, event.block.timestamp, event.block.number);

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

  const weth_bd = toDecimal(reserves[0], 18);
  const bean_bd = toDecimal(reserves[1]);

  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);
  let startLiquidityUSD = pool.liquidityUSD;
  let endLiquidityUSD = weth_bd.times(weth.lastPriceUSD).times(BigDecimal.fromString("2"));
  let deltaLiquidityUSD = endLiquidityUSD.minus(startLiquidityUSD);
  let deltaBeans = uniswapV2DeltaB(bean_bd, weth_bd, weth.lastPriceUSD);

  updatePoolValues(event.address.toHexString(), event.block.timestamp, event.block.number, ZERO_BI, ZERO_BD, deltaLiquidityUSD, deltaBeans);

  let currentBeanPrice = uniswapV2Price(bean_bd, weth_bd, weth.lastPriceUSD);

  updatePoolPrice(event.address.toHexString(), event.block.timestamp, event.block.number, currentBeanPrice);

  checkBeanCross(BEAN_ERC20_V1.toHexString(), event.block.timestamp, event.block.number, oldBeanPrice, currentBeanPrice);

  setPoolReserves(event.address.toHexString(), reserves, event.block.timestamp, event.block.number);

  updateBeanSupplyPegPercent(event.block.number);

  updateBeanValues(BEAN_ERC20_V1.toHexString(), event.block.timestamp, currentBeanPrice, ZERO_BI, ZERO_BI, ZERO_BD, deltaLiquidityUSD);
}

export function onSunriseSetUniswapV2Twa(poolAddress: string, timestamp: BigInt, blockNumber: BigInt): void {
  const prices = getTWAPrices(poolAddress, TWAType.UNISWAP, timestamp);

  let beanstalk = PreReplant.bind(BEANSTALK);
  let reserves: BigInt[];
  // After BIP-9, reserves calculation changes
  if (blockNumber.lt(BigInt.fromU64(13953949))) {
    const result = beanstalk.reserves();
    reserves = [result.value0, result.value1];
  } else {
    const result = beanstalk.lockedReserves();
    reserves = [result.value0, result.value1];
  }

  const mulReserves = reserves[0].times(reserves[1]).times(BI_10.pow(6));
  const currentBeans = mulReserves.div(prices[0]).sqrt();
  const targetBeans = mulReserves.div(prices[1]).sqrt();
  const deltaB = targetBeans.minus(currentBeans);
  const twaPrice = BigDecimal.fromString(prices[0].toString()).div(BigDecimal.fromString(prices[1].toString()));

  let poolHourly = loadOrCreatePoolHourlySnapshot(poolAddress, timestamp, blockNumber);
  let poolDaily = loadOrCreatePoolDailySnapshot(poolAddress, timestamp, blockNumber);
  poolHourly.twaDeltaBeans = deltaB;
  poolHourly.twaPrice = twaPrice;
  poolDaily.twaDeltaBeans = deltaB;
  poolDaily.twaPrice = twaPrice;
  poolHourly.save();
  poolDaily.save();
}
