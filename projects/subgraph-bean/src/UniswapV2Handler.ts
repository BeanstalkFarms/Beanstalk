import { BigDecimal } from "@graphprotocol/graph-ts";
import { Burn, Mint, UniswapV2Pair } from "../generated/BeanUniswapV2Pair/UniswapV2Pair";
import { ZERO_BD, ZERO_BI } from "./helpers";
import { WETH, WETH_USDC_PAIR } from "./utils/Constants";
import { toDecimal } from "./utils/Decimals";
import { loadOrCreatePool, updatePoolPrice, updatePoolValues } from "./utils/Pool";
import { loadOrCreateToken } from "./utils/Token";

export function handleSync(event: Mint): void {

    let pair = UniswapV2Pair.bind(event.address)

    let reserves = pair.try_getReserves()
    if (reserves.reverted) { return }

    // Token 0 is WETH and Token 1 is BEAN

    updatePriceETH()
    let weth = loadOrCreateToken(WETH.toHexString())

    let wethBalance = toDecimal(reserves.value.value0, 18)
    let beanBalance = toDecimal(reserves.value.value1)

    let pool = loadOrCreatePool(event.address.toHexString(), event.block.number)
    let startLiquidityUSD = pool.liquidityUSD
    let endLiquidityUSD = wethBalance.times(weth.lastPriceUSD).times(BigDecimal.fromString('2'))
    let deltaLiquidityUSD = endLiquidityUSD.minus(startLiquidityUSD)

    updatePoolValues(event.address.toHexString(), event.block.timestamp, event.block.number, ZERO_BI, ZERO_BD, deltaLiquidityUSD)

    let oldPrice = pool.lastPrice
    let currentBeanPrice = beanBalance.div((wethBalance).times(weth.lastPriceUSD))

    updatePoolPrice(event.address.toHexString(), event.block.timestamp, event.block.number, currentBeanPrice)
}

function updatePriceETH(): void {
    let token = loadOrCreateToken(WETH.toHexString())
    let pair = UniswapV2Pair.bind(WETH_USDC_PAIR)

    let reserves = pair.try_getReserves()
    if (reserves.reverted) { return }

    // Token 0 is USDC and Token 1 is WETH
    token.lastPriceUSD = toDecimal(reserves.value.value0).div(toDecimal(reserves.value.value1, 18))
    token.save()
}
