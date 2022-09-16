
const { toX } = require('../test/utils/helpers.js')
const { getEthUsdChainlinkOracle } = require('./contracts.js')

async function getEthUsdPrice() {
    const ethUdsChainlinkOracle = await getEthUsdChainlinkOracle()
    answer = await ethUdsChainlinkOracle.latestRoundData()
    return answer.answer
}

exports.getEthUsdPrice = getEthUsdPrice