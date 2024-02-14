const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getAltBeanstalk, getBean } = require('../utils/contracts.js');
const { BEAN_3_CURVE, ETH_USDC_UNISWAP_V3, BEAN, UNRIPE_BEAN, UNRIPE_LP, BEAN_ETH_WELL, MAX_UINT256 } = require('./utils/constants.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { deployMockWell, deployMockBeanEthWell } = require('../utils/well.js');
const { advanceTime } = require('../utils/helpers.js');
const { setEthUsdPrice, setEthUsdcPrice, setEthUsdtPrice } = require('../scripts/usdOracle.js');
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let user, user2, owner;

async function setToSecondsAfterHour(seconds = 0) {
    const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
    const hourTimestamp = parseInt(lastTimestamp/3600 + 1) * 3600 + seconds
    await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp])
}

describe('Season', function () {
    before(async function () {
        [owner, user, user2] = await ethers.getSigners();
        const contracts = await deploy("Test", false, true);
        this.diamond = contracts.beanstalkDiamond;
        beanstalk = await getAltBeanstalk(this.diamond.address)
        
        // add unripe
        this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
        this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address)
        this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
        this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
        this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
        this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
        bean = await ethers.getContractAt('MockToken', BEAN)
        await this.unripeLP.mint(user.address, to6('1000'))
        await this.unripeLP.connect(user).approve(this.diamond.address, to6('100000000'))
        await this.unripeBean.mint(user.address, to6('1000'))
        await this.unripeBean.connect(user).approve(this.diamond.address, to6('100000000'))
        await this.fertilizer.setFertilizerE(true, to6('10000'))
        await this.unripe.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES);
        await this.unripe.addUnripeToken(UNRIPE_LP, BEAN_ETH_WELL, ZERO_BYTES);

        this.whitelist = await ethers.getContractAt('WhitelistFacet', this.diamond.address);
        this.result = await this.whitelist.connect(owner).dewhitelistToken(BEAN_3_CURVE);

        // add wells
        [this.well, this.wellFunction, this.pump] = await deployMockBeanEthWell()
        await this.well.setReserves([to6('1000000'), to18('1000')])
        await advanceTime(3600)
        await owner.sendTransaction({to: user.address, value: 0});
        await setToSecondsAfterHour(0)
        await owner.sendTransaction({to: user.address, value: 0});
        await beanstalk.connect(user).sunrise();
        await this.well.connect(user).mint(user.address, to18('1000'))

        // init eth/usd oracles
        await setEthUsdPrice('999.998018')
        await setEthUsdcPrice('1000')
        await setEthUsdtPrice('1000')
    })

    beforeEach(async function () {
        snapshotId = await takeSnapshot();
    });
    
    afterEach(async function () {
        await revertToSnapshot(snapshotId);
    });

    describe("previous balance = 0", async function () {
        beforeEach(async function () {
            await this.well.setReserves([to6('0'), to18('0')])
            await advanceTime(3600)
        })

        it('season incentive', async function () {
            await setToSecondsAfterHour(0)
            await beanstalk.connect(owner).sunrise();
            expect(await bean.balanceOf(owner.address)).to.be.equal(to6('100'))
        })
    
        it('30 seconds after season incentive', async function () {
            await setToSecondsAfterHour(30)
            await beanstalk.connect(owner).sunrise();
            expect(await bean.balanceOf(owner.address)).to.be.equal('126973464')
        })
    
        it('300 seconds after season incentive', async function () {
            await setToSecondsAfterHour(300)
            await beanstalk.connect(owner).sunrise();
            expect(await bean.balanceOf(owner.address)).to.be.equal('1978846626')
        })
    
        it('1500 seconds after season incentive', async function () {
            await setToSecondsAfterHour(1500)
            await beanstalk.connect(owner).sunrise();
            expect(await bean.balanceOf(owner.address)).to.be.equal('1978846626')
        })
    })

    describe("oracle not initialized, previous balance > 0", async function () {
        it('season incentive', async function () {
            await setToSecondsAfterHour(0)
            await beanstalk.connect(owner).sunrise();
            expect(await bean.balanceOf(owner.address)).to.be.within('11600000', '18000000')
        })
    })

    describe("oracle initialized", async function () {
        it('season incentive', async function () {
            await this.well.setReserves([to6('100000'), to18('100')])
            await setToSecondsAfterHour(0)
            await beanstalk.connect(user).sunrise();
            await setToSecondsAfterHour(0)
            await beanstalk.connect(owner).sunrise();

            expect(await bean.balanceOf(owner.address)).to.be.within('15300000', '15600000')
        })
    })
})