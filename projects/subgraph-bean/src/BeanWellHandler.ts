import { Address, BigDecimal, BigInt, ethereum, log } from "@graphprotocol/graph-ts";
import { BEANSTALK_PRICE, BEANSTALK_PRICE_BLOCK, BEAN_ERC20 } from "../../subgraph-core/utils/Constants";
import { ZERO_BD, ZERO_BI, deltaBigIntArray, toDecimal } from "../../subgraph-core/utils/Decimals";
import { BeanstalkPrice } from "../generated/BeanWETHCP2w/BeanstalkPrice";
import { AddLiquidity, RemoveLiquidity, RemoveLiquidityOneToken, Shift, Swap, Sync } from "../generated/BeanWETHCP2w/Well";
import { loadBean, updateBeanSupplyPegPercent, updateBeanValues } from "./utils/Bean";
import { getPoolLiquidityUSD, loadOrCreatePool, setPoolReserves, updatePoolPrice, updatePoolValues } from "./utils/Pool";
import { checkBeanCross, checkPoolCross } from "./utils/Cross";
import { BEAN_WELLS, WellFunction } from "./utils/BeanWells";

export function handleAddLiquidity(event: AddLiquidity): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.tokenAmountsIn[0],
    event.params.tokenAmountsIn[1],
    false
  );
}

export function handleRemoveLiquidity(event: RemoveLiquidity): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.tokenAmountsOut[0],
    event.params.tokenAmountsOut[1],
    true
  );
}

export function handleRemoveLiquidityOneToken(event: RemoveLiquidityOneToken): void {
  handleLiquidityChange(
    event.address.toHexString(),
    event.block.timestamp,
    event.block.number,
    event.params.tokenOut == BEAN_ERC20 ? event.params.tokenAmountOut : ZERO_BI,
    event.params.tokenOut != BEAN_ERC20 ? event.params.tokenAmountOut : ZERO_BI,
    true
  );
}

export function handleSync(event: Sync): void {
  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);

  let deltaReserves = deltaBigIntArray(event.params.reserves, pool.reserves);

  handleLiquidityChange(event.address.toHexString(), event.block.timestamp, event.block.number, deltaReserves[0], deltaReserves[1], false);
}

export function handleSwap(event: Swap): void {
  handleSwapEvent(
    event.address.toHexString(),
    event.params.toToken,
    event.params.amountIn,
    event.params.amountOut,
    event.block.timestamp,
    event.block.number
  );
}

export function handleShift(event: Shift): void {
  let pool = loadOrCreatePool(event.address.toHexString(), event.block.number);

  let deltaReserves = deltaBigIntArray(event.params.reserves, pool.reserves);

  handleSwapEvent(
    event.address.toHexString(),
    event.params.toToken,
    event.params.toToken == BEAN_ERC20 ? deltaReserves[1] : deltaReserves[0],
    event.params.amountOut,
    event.block.timestamp,
    event.block.number
  );
}

export function handleBlock(block: ethereum.Block): void {
  // BeanstalkPrice contract was not deployed until about 20 mins after the first Well's deployment.
  // In practice no data is lost by discarding these blocks, and the same is done elsewhere.
  if (block.number.lt(BEANSTALK_PRICE_BLOCK)) {
    return;
  }

  const beanstalkPrice = BeanstalkPrice.bind(BEANSTALK_PRICE);
  const beanPrice = beanstalkPrice.try_price();
  const bean = loadBean(BEAN_ERC20.toHexString());
  const prevPrice = bean.price;
  const newPrice = toDecimal(beanPrice.value.price);

  log.debug("Prev/New bean price {} / {}", [prevPrice.toString(), newPrice.toString()]);

  // Check for overall peg cross
  const beanCrossed = checkBeanCross(BEAN_ERC20.toHexString(), block.timestamp, block.number, prevPrice, newPrice);

  // Update pool price for each pool - necessary for checking pool cross
  let totalLiquidity = ZERO_BD;
  for (let i = 0; i < BEAN_WELLS.length; ++i) {
    const wellInfo = BEAN_WELLS[i];
    if (block.number.lt(wellInfo.startBlock)) {
      continue;
    }

    const well = loadOrCreatePool(wellInfo.address.toHexString(), block.number);

    // Currently there is only one Well function, this needs to be expanded as more Bean wells are added.
    // wellInfo.wellFunction == WellFunction.ConstantProduct ? ...
    const newWellPrice = beanstalkPrice.try_getConstantProductWell(wellInfo.address).value;
    const poolCrossed = checkPoolCross(
      wellInfo.address.toHexString(),
      block.timestamp,
      block.number,
      well.lastPrice,
      toDecimal(newWellPrice.price)
    );

    if (poolCrossed || beanCrossed) {
      totalLiquidity = totalLiquidity.plus(toDecimal(newWellPrice.liquidity));
      updatePoolValues(
        wellInfo.address.toHexString(),
        block.timestamp,
        block.number,
        ZERO_BI,
        ZERO_BD,
        toDecimal(newWellPrice.liquidity).minus(well.liquidityUSD),
        newWellPrice.deltaB
      );
      updatePoolPrice(wellInfo.address.toHexString(), block.timestamp, block.number, toDecimal(newWellPrice.price), false);
    }
  }

  // Update bean values at the end now that the summation of pool liquidity is known
  if (beanCrossed) {
    updateBeanValues(
      BEAN_ERC20.toHexString(),
      block.timestamp,
      newPrice,
      ZERO_BI,
      ZERO_BI,
      ZERO_BD,
      totalLiquidity.minus(bean.liquidityUSD)
    );
  }
}

function handleLiquidityChange(
  poolAddress: string,
  timestamp: BigInt,
  blockNumber: BigInt,
  token0Amount: BigInt,
  token1Amount: BigInt,
  removal: boolean
): void {
  // Get Price Details via Price contract
  let beanstalkPrice = BeanstalkPrice.bind(BEANSTALK_PRICE);
  let wellPrice = beanstalkPrice.try_getConstantProductWell(Address.fromString(poolAddress));
  let beanPrice = beanstalkPrice.try_price();

  if (wellPrice.reverted || beanPrice.reverted) {
    return;
  }

  let bean = loadBean(BEAN_ERC20.toHexString());
  let oldBeanPrice = bean.price;

  let startingLiquidity = getPoolLiquidityUSD(poolAddress, blockNumber);

  let newPrice = toDecimal(wellPrice.value.price);
  let deltaLiquidityUSD = toDecimal(wellPrice.value.liquidity).minus(startingLiquidity);

  let volumeUSD = ZERO_BD;
  let volumeBean = ZERO_BI;
  if ((token0Amount == ZERO_BI || token1Amount == ZERO_BI) && removal) {
    if (token0Amount != ZERO_BI) {
      volumeBean = token0Amount.div(BigInt.fromI32(2));
      volumeUSD = toDecimal(token0Amount).times(toDecimal(wellPrice.value.price));
    } else {
      let wellPairInBean = toDecimal(wellPrice.value.balances[0]).div(toDecimal(wellPrice.value.balances[1], 18));
      volumeBean = BigInt.fromString(
        toDecimal(token1Amount, 18)
          .times(wellPairInBean)
          .times(BigDecimal.fromString("1000000"))
          .div(BigDecimal.fromString("2"))
          .truncate(0)
          .toString()
      );
      volumeUSD = toDecimal(volumeBean).times(toDecimal(wellPrice.value.price));
    }
  }

  setPoolReserves(poolAddress, wellPrice.value.balances, blockNumber);
  updateBeanSupplyPegPercent(blockNumber);

  updateBeanValues(
    BEAN_ERC20.toHexString(),
    timestamp,
    toDecimal(beanPrice.value.price),
    ZERO_BI,
    volumeBean,
    volumeUSD,
    deltaLiquidityUSD
  );

  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, wellPrice.value.deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPrice);
  checkBeanCross(BEAN_ERC20.toHexString(), timestamp, blockNumber, oldBeanPrice, toDecimal(beanPrice.value.price));
}

function handleSwapEvent(
  poolAddress: string,
  toToken: Address,
  amountIn: BigInt,
  amountOut: BigInt,
  timestamp: BigInt,
  blockNumber: BigInt
): void {
  // Get Price Details via Price contract
  let beanstalkPrice = BeanstalkPrice.bind(BEANSTALK_PRICE);
  let wellPrice = beanstalkPrice.try_getConstantProductWell(Address.fromString(poolAddress));
  let beanPrice = beanstalkPrice.try_price();

  if (wellPrice.reverted || beanPrice.reverted) {
    return;
  }

  let bean = loadBean(BEAN_ERC20.toHexString());
  let oldBeanPrice = bean.price;

  let startingLiquidity = getPoolLiquidityUSD(poolAddress, blockNumber);

  let newPrice = toDecimal(wellPrice.value.price);
  let volumeBean = toToken == BEAN_ERC20 ? amountOut : amountIn;

  let volumeUSD = toDecimal(volumeBean).times(newPrice);
  let deltaLiquidityUSD = toDecimal(wellPrice.value.liquidity).minus(startingLiquidity);

  setPoolReserves(poolAddress, wellPrice.value.balances, blockNumber);
  updateBeanSupplyPegPercent(blockNumber);

  updateBeanValues(
    BEAN_ERC20.toHexString(),
    timestamp,
    toDecimal(beanPrice.value.price),
    ZERO_BI,
    volumeBean,
    volumeUSD,
    deltaLiquidityUSD
  );

  updatePoolValues(poolAddress, timestamp, blockNumber, volumeBean, volumeUSD, deltaLiquidityUSD, wellPrice.value.deltaB);
  updatePoolPrice(poolAddress, timestamp, blockNumber, newPrice);
  checkBeanCross(BEAN_ERC20.toHexString(), timestamp, blockNumber, oldBeanPrice, toDecimal(beanPrice.value.price));
}
