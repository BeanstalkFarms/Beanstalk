const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getAltBeanstalk, getBean } = require('../utils/contracts.js');
const { BEAN_3_CURVE, ETH_USDC_UNISWAP_V3 } = require('./utils/constants.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const { deployMockWell } = require('../utils/well.js');
const { advanceTime } = require('../utils/helpers.js');

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
        beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address)
        bean = await getBean();

        [this.well, this.wellFunction, this.pump] = await deployMockWell()
        await this.well.setReserves([to6('1000000'), to18('1000')])
        await advanceTime(3600)
        await owner.sendTransaction({to: user.address, value: 0});
        await setToSecondsAfterHour(0)
        await owner.sendTransaction({to: user.address, value: 0});
        await beanstalk.connect(user).sunrise();
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
        it.skip('season incentive', async function () {
            this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
            await this.beanMetapool.set_A_precise('1000');
            await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'));
            await this.beanMetapool.connect(user).set_balances([to6('1000'), to18('1000')]);
            await this.beanMetapool.connect(user).set_balances([to6('1000'), to18('1000')]);

            await setToSecondsAfterHour(0)
            await beanstalk.connect(owner).sunrise();
            expect(await bean.balanceOf(owner.address)).to.be.within('10700000', '10800000')
        })
    })

    describe("oracle initialized", async function () {
        it.skip('season incentive', async function () {
            this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
            await this.beanMetapool.set_A_precise('1000');
            await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'));
            await this.beanMetapool.connect(user).set_balances([to6('1000'), to18('1000')]);
            await this.beanMetapool.connect(user).set_balances([to6('1000'), to18('1000')]);

            await setToSecondsAfterHour(0)
            await beanstalk.connect(user).sunrise();
            await setToSecondsAfterHour(0)  
            await beanstalk.connect(owner).sunrise();
            expect(await bean.balanceOf(owner.address)).to.be.within('10500000', '10600000')
        })
    })
})