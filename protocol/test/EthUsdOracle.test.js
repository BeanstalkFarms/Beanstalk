const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getBeanstalk, getBean } = require('../utils/contracts.js');
const { ETH_USDC_UNISWAP_V3, ETH_USDT_UNISWAP_V3, WETH, ETH_USD_CHAINLINK_AGGREGATOR } = require('./utils/constants.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { toBN } = require('../utils/helpers.js');
const { setEthUsdcPrice, setEthUsdChainlinkPrice, setEthUsdtPrice, setOracleFailure } = require('../utils/oracle.js');

let user, user2, owner;

async function setToSecondsAfterHour(seconds = 0) {
    const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const hourTimestamp = parseInt(lastTimestamp/3600 + 1) * 3600 + seconds
    await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp])
}

describe('USD Oracle', function () {
    before(async function () {
        [owner, user, user2] = await ethers.getSigners();
        const contracts = await deploy("Test", false, true);
        season = await ethers.getContractAt('MockSeasonFacet', contracts.beanstalkDiamond.address)
        beanstalk = await getBeanstalk(contracts.beanstalkDiamond.address)
        bean = await getBean()
        await setToSecondsAfterHour(0)
        await owner.sendTransaction({to: user.address, value: 0})

        await setEthUsdChainlinkPrice('10000')
    })

    beforeEach(async function () {
        snapshotId = await takeSnapshot();
    });
    
    afterEach(async function () {
        await revertToSnapshot(snapshotId);
    });

    it("it gets the USD price", async function () {
        expect(await season.getEthUsdPrice()).to.be.equal(to6('10000')) // About 1e14
        expect(await season.getEthUsdTwap(900)).to.be.equal(to6('10000')) // About 1e14
        expect(await season.getUsdPrice(WETH)).to.be.equal(to18('0.0001')) // About 1e14
    })

    it("it gets the USD TWA", async function () {
        await setEthUsdChainlinkPrice('20000', lookback = 449)
        expect(await season.getEthUsdTwap(900)).to.be.equal(to6('15000')) // About 1e14

    })

    it ('Handles Chainlink Oracle Failure', async function () {
        const chainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
        await chainlinkAggregator.setRound('1', '0', to18('1'), '0', '0')
        expect(await season.getEthUsdPrice()).to.be.equal('0') // About 1e14
        expect(await season.getEthUsdTwap(900)).to.be.equal('0') // About 1e14
        expect(await season.getUsdPrice(WETH)).to.be.equal('0') // About 1e14
    })
})