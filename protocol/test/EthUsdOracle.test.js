const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getAltBeanstalk, getBean, getUsdc } = require('../utils/contracts.js');
const { signERC2612Permit } = require("eth-permit");
const { BEAN_3_CURVE, THREE_POOL, THREE_CURVE, PIPELINE, BEANSTALK, ETH_USDC_UNISWAP_V3, ETH_USDT_UNISWAP_V3, WETH, ETH_USD_CHAINLINK_AGGREGATOR } = require('./utils/constants.js');
const { to6, to18, toX } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { deployMockWell } = require('../utils/well.js');
const { upgradeWithNewFacets } = require('../scripts/diamond.js');
const { impersonateBeanstalkOwner } = require('../utils/signer.js');
const { mintEth } = require('../utils/mint.js');
const { toBN } = require('../utils/helpers.js');

let user, user2, owner;

let ethUsdcUniswapPool, ethUsdtUniswapPool, ethUsdChainlinkAggregator;

async function setEthUsdcPrice(price) {
    await ethUsdcUniswapPool.setOraclePrice(to6(price), 18);
}

async function setEthUsdPrice(price) {
    const block = await ethers.provider.getBlock("latest");
    await ethUsdChainlinkAggregator.addRound(to6(price), block.timestamp, block.timestamp, '1')
}

async function setEthUsdtPrice(price) {
    await ethUsdtUniswapPool.setOraclePrice(to18('1').div(toBN('1').add(price)), 6);
}

async function printPrices() {
    console.log(`CUSD Price: ${await season.getChainlinkEthUsdPrice()}`)
    console.log(`USDT Price: ${await season.getEthUsdtPrice()}`)
    console.log(`USDC Price: ${await season.getEthUsdcPrice()}`)

}

async function setToSecondsAfterHour(seconds = 0) {
    const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const hourTimestamp = parseInt(lastTimestamp/3600 + 1) * 3600 + seconds
    await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp])
}

async function checkPriceWithError(price, error = '1000000') {
    expect(await season.getEthUsdPrice()).to.be.within(
        to6(price).sub(toBN(error).div('2')),
        to6(price).add(toBN(error).div('2'))
    ) // Expected Rounding error
}

describe('USD Oracle', function () {
    before(async function () {
        [owner, user, user2] = await ethers.getSigners();
        const contracts = await deploy("Test", false, true);
        season = await ethers.getContractAt('MockSeasonFacet', contracts.beanstalkDiamond.address)
        beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address)
        bean = await getBean()
        await setToSecondsAfterHour(0)
        await owner.sendTransaction({to: user.address, value: 0})

        ethUsdtUniswapPool = await ethers.getContractAt('MockUniswapV3Pool', ETH_USDT_UNISWAP_V3);
        ethUsdChainlinkAggregator = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
        await ethUsdChainlinkAggregator.setDecimals(6)
        ethUsdcUniswapPool = await ethers.getContractAt('MockUniswapV3Pool', ETH_USDC_UNISWAP_V3);

        await setEthUsdPrice('10000')
        await setEthUsdcPrice('10000')
        await setEthUsdtPrice('10000')

        console.log(await season.getEthUsdcPrice())

        season = await ethers.getContractAt('MockSeasonFacet', BEANSTALK)
    })

    beforeEach(async function () {
        snapshotId = await takeSnapshot();
    });
    
    afterEach(async function () {
        await revertToSnapshot(snapshotId);
    });

    it("it gets the USD price when Chainlink = USDC", async function () {
        console.log(`Price: ${await season.getEthUsdPrice()}`)
        await checkPriceWithError('10000')
        expect(await season.getUsdPrice(WETH)).to.be.equal('99999911880077') // About 1e14
    })

    describe(">= Chainlink", async function () {
        it("it gets the USD price when Chainlink ~= USDC & = USDT", async function () {
            await setEthUsdcPrice('10040')
            await checkPriceWithError('10020')
        })
    
        it("it gets the USD price when Chainlink < USDC & << USDT", async function () {
            await setEthUsdcPrice('10100')
            await setEthUsdtPrice('10200')
            await checkPriceWithError('10050')
        })
    
        it("it gets the USD price when Chainlink << USDC & < USDT", async function () {
            await setEthUsdcPrice('10200')
            await setEthUsdtPrice('10100')
            await checkPriceWithError('10050')
        })
    
        it("it gets the USD price when Chainlink < USDC & = USDT", async function () {
            await setEthUsdcPrice('10100')
            await checkPriceWithError('10000')
        })
    
        it("it gets the USD price when Chainlink << USDC & << USDT", async function () {
            await setEthUsdcPrice('10500')
            await setEthUsdtPrice('10500')
            await checkPriceWithError('0', error = '0')
        })
    })

    describe("<= Chainlink", async function () {
        it("it gets the USD price when Chainlink ~= USDC & = USDT", async function () {
            await setEthUsdcPrice('9960')
            await checkPriceWithError('9980')
        })
    
        it("it gets the USD price when Chainlink > USDC & >> USDT", async function () {
            await setEthUsdcPrice('9900')
            await setEthUsdtPrice('9800')
            await checkPriceWithError('9950')
        })
    
        it("it gets the USD price when Chainlink >> USDC & > USDT", async function () {
            await setEthUsdcPrice('9800')
            await setEthUsdtPrice('9900')
            await checkPriceWithError('9950')
        })
    
        it("it gets the USD price when Chainlink > USDC & = USDT", async function () {
            await setEthUsdcPrice('9900')
            await checkPriceWithError('10000')
        })
    
        it("it gets the USD price when Chainlink >> USDC & >> USDT", async function () {
            await setEthUsdcPrice('9500')
            await setEthUsdtPrice('9500')
            await checkPriceWithError('0', error = '0')
        })
    })

    describe(">= & <= Chainlink", async function () {
        it("it gets the USD price when Chainlink < USDC & >> USDT", async function () {
            await setEthUsdcPrice('10100')
            await setEthUsdtPrice('9800')
            await checkPriceWithError('10050')
        })

        it("it gets the USD price when Chainlink >> USDC & < USDT", async function () {
            await setEthUsdcPrice('9800')
            await setEthUsdtPrice('10100')
            await checkPriceWithError('10050')
        })
    
        it("it gets the USD price when Chainlink << USDC & > USDT", async function () {
            await setEthUsdcPrice('10200')
            await setEthUsdtPrice('9900')
            await checkPriceWithError('9950')
        })

        it("it gets the USD price when Chainlink > USDC & << USDT", async function () {
            await setEthUsdcPrice('9900')
            await setEthUsdtPrice('10200')
            await checkPriceWithError('9950')
        })
    
        it("it gets the USD price when Chainlink << USDC & >> USDT", async function () {
            await setEthUsdcPrice('10500')
            await setEthUsdtPrice('9500')
            await expect(season.getUsdPrice(WETH)).to.be.revertedWith("Oracle: Failed")
            expect(await season.getEthUsdPrice()).to.be.equal('0')
        })
    })
})