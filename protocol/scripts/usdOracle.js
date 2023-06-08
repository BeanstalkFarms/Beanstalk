const { ETH_USDT_UNISWAP_V3, ETH_USDC_UNISWAP_V3, ETH_USD_CHAINLINK_AGGREGATOR } = require("../test/utils/constants");
const { to18, to6 } = require("../test/utils/helpers");
const { toBN } = require("../utils");

async function setEthUsdcPrice(price) {
    const ethUsdcUniswapPool = await ethers.getContractAt('MockUniswapV3Pool', ETH_USDC_UNISWAP_V3);
    await ethUsdcUniswapPool.setOraclePrice(to6(price), 18);
}

async function setEthUsdPrice(price) {
    const ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
    const block = await ethers.provider.getBlock("latest");
    await ethUsdChainlinkAggregator.addRound(to6(price), block.timestamp, block.timestamp, '1')
}

async function setEthUsdtPrice(price) {
    const ethUsdtUniswapPool = await ethers.getContractAt('MockUniswapV3Pool', ETH_USDT_UNISWAP_V3);
    await ethUsdtUniswapPool.setOraclePrice(to18('1').div(toBN('1').add(price)), 6);
}

exports.setEthUsdcPrice = setEthUsdcPrice;
exports.setEthUsdPrice = setEthUsdPrice;
exports.setEthUsdtPrice = setEthUsdtPrice;