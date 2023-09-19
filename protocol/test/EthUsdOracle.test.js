const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getAltBeanstalk, getBean } = require('../utils/contracts.js');
const { ETH_USDC_UNISWAP_V3, ETH_USDT_UNISWAP_V3, WETH } = require('./utils/constants.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { toBN } = require('../utils/helpers.js');
const { setEthUsdcPrice, setEthUsdPrice, setEthUsdtPrice, setOracleFailure } = require('../utils/oracle.js');

let user, user2, owner;

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

        await setEthUsdPrice('10000')
        await setEthUsdcPrice('10000')
        await setEthUsdtPrice('10000')
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
            await setEthUsdcPrice('10020')
            await checkPriceWithError('10010')
        })
    
        it("it gets the USD price when Chainlink < USDC & << USDT", async function () {
            await setEthUsdcPrice('10050')
            await setEthUsdtPrice('10100')
            await checkPriceWithError('10025')
        })
    
        it("it gets the USD price when Chainlink << USDC & < USDT", async function () {
            await setEthUsdcPrice('10100')
            await setEthUsdtPrice('10050')
            await checkPriceWithError('10025')
        })
    
        it("it gets the USD price when Chainlink < USDC & = USDT", async function () {
            await setEthUsdcPrice('10100')
            await checkPriceWithError('10000')
        })
    
        it("it gets the USD price when Chainlink << USDC & << USDT", async function () {
            await setEthUsdcPrice('10500')
            await setEthUsdtPrice('10500')
            await checkPriceWithError('10000', error = '0')
        })
    })

    describe("<= Chainlink", async function () {
        it("it gets the USD price when Chainlink ~= USDC & = USDT", async function () {
            await setEthUsdcPrice('9970')
            await checkPriceWithError('9985')
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
            await checkPriceWithError('10000', error = '0')
        })
    })

    describe(">= & <= Chainlink", async function () {
        it("it gets the USD price when Chainlink < USDC & >> USDT", async function () {
            await setEthUsdcPrice('10050')
            await setEthUsdtPrice('9800')
            await checkPriceWithError('10025')
        })

        it("it gets the USD price when Chainlink >> USDC & < USDT", async function () {
            await setEthUsdcPrice('9800')
            await setEthUsdtPrice('10050')
            await checkPriceWithError('10025')
        })
    
        it("it gets the USD price when Chainlink << USDC & > USDT", async function () {
            await setEthUsdcPrice('10200')
            await setEthUsdtPrice('9950')
            await checkPriceWithError('9975')
        })

        it("it gets the USD price when Chainlink > USDC & << USDT", async function () {
            await setEthUsdcPrice('9900')
            await setEthUsdtPrice('10200')
            await checkPriceWithError('9950')
        })
    
        it("it gets the USD price when Chainlink << USDC & >> USDT", async function () {
            await setEthUsdcPrice('10500')
            await setEthUsdtPrice('9500')
            await checkPriceWithError('10000', error = '0')
        })
    })

    describe("Handles Uniswap Oracle Failure", async function () {
        it ('succeeds when ETH/USDT call fails', async function () {
            await setOracleFailure(true, ETH_USDT_UNISWAP_V3)
            await setEthUsdcPrice('10050')
            await checkPriceWithError('10025')
        })

        it ('succeeds when ETH/USDC call fails', async function () {
            await setOracleFailure(true, ETH_USDC_UNISWAP_V3)
            await checkPriceWithError('10000')
        })
    })
})