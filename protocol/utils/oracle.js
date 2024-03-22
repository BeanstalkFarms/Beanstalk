const { ETH_USDC_UNISWAP_V3, ETH_USD_CHAINLINK_AGGREGATOR, ETH_USDT_UNISWAP_V3, BEANSTALK, WSTETH_ETH_UNIV3_01_POOL, STETH_ETH_CHAINLINK_PRICE_AGGREGATOR, WSTETH } = require("../test/utils/constants");
const { to18, to6, toX } = require("../test/utils/helpers");
const { toBN } = require("./helpers");

async function setEthUsdcPrice(price) {
    const ethUsdcUniswapPool = await ethers.getContractAt('MockUniswapV3Pool', ETH_USDC_UNISWAP_V3);
    await ethUsdcUniswapPool.setOraclePrice(to6(price), 18);
}

async function setEthUsdChainlinkPrice(price, secondsAgo = 900) {
    const ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
    const block = await ethers.provider.getBlock("latest");
    await ethUsdChainlinkAggregator.addRound(to6(price), block.timestamp-secondsAgo, block.timestamp-secondsAgo, '1')
}

async function setEthUsdtPrice(price) {
    const ethUsdtUniswapPool = await ethers.getContractAt('MockUniswapV3Pool', ETH_USDT_UNISWAP_V3);
    await ethUsdtUniswapPool.setOraclePrice(to18('1').div(toBN('1').add(price)), 6);
}

async function setWstethEthUniswapPrice(price) {
    const wstethEthUniswapPool = await ethers.getContractAt('MockUniswapV3Pool', WSTETH_ETH_UNIV3_01_POOL);
    await wstethEthUniswapPool.setOraclePrice(toX('1', 36).div(toBN('1').add(to18(price))), 18);
}

async function setWstethStethRedemptionPrice(price) {
    const wsteth = await ethers.getContractAt("MockWsteth", WSTETH);
    await wsteth.setStEthPerToken(to18(price));
}

async function setStethEthChainlinkPrice(price, secondsAgo = 900) {
    const ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', STETH_ETH_CHAINLINK_PRICE_AGGREGATOR)
    const block = await ethers.provider.getBlock("latest");
    await ethUsdChainlinkAggregator.addRound(to6(price), block.timestamp-secondsAgo, block.timestamp-secondsAgo, '1')
}

async function setWstethUsdPrice(price) {
    await setStethEthChainlinkPrice(price);
    await setWstethEthUniswapPrice(price);
    await setWstethStethRedemptionPrice('1');
    await setEthUsdChainlinkPrice(price);

}

async function setOracleFailure(bool, poolAddress) {
    const pool = await ethers.getContractAt('MockUniswapV3Pool', poolAddress);
    await pool.setOracleFailure(bool);
}

exports.setEthUsdcPrice = setEthUsdcPrice;
exports.setEthUsdChainlinkPrice = setEthUsdChainlinkPrice;
exports.setEthUsdtPrice = setEthUsdtPrice;
exports.setOracleFailure  = setOracleFailure;
exports.setWstethEthUniswapPrice = setWstethEthUniswapPrice
exports.setStethEthChainlinkPrice = setStethEthChainlinkPrice
exports.setWstethStethRedemptionPrice = setWstethStethRedemptionPrice
exports.setWstethUsdPrice = setWstethUsdPrice;