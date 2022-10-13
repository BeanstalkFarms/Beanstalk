
const { toX } = require('../test/utils/helpers.js')
const { getEthUsdChainlinkOracle, getLiquityPriceFeed } = require('./contracts.js')

async function getEthUsdPrice() {
    const ethUsdChainlinkOracle = await getEthUsdChainlinkOracle()
    answer = await ethUsdChainlinkOracle.latestRoundData()
    return answer.answer
}


async function getLiquityEthUsdPrice() {
    const liquityPriceFeed = await getLiquityPriceFeed()
    return  await liquityPriceFeed.callStatic.fetchPrice()
}


exports.getEthUsdPrice = getEthUsdPrice
exports.getLiquityEthUsdPrice = getLiquityEthUsdPrice