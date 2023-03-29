const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getAltBeanstalk, getBean, getUsdc } = require('../utils/contracts.js');
const { signERC2612Permit } = require("eth-permit");
const { BEAN_3_CURVE, THREE_POOL, THREE_CURVE, PIPELINE, BEANSTALK } = require('./utils/constants.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

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
        bean = await getBean()
        await setToSecondsAfterHour(0)
        await owner.sendTransaction({to: user.address, value: 0})
    })

    beforeEach(async function () {
        snapshotId = await takeSnapshot();
    });
    
    afterEach(async function () {
        await revertToSnapshot(snapshotId);
    });

    it('season incentive', async function () {
        await setToSecondsAfterHour(0)
        await beanstalk.connect(owner).sunrise();
        expect(await bean.balanceOf(owner.address)).to.be.equal(to6('3'))
    })

    it('30 seconds after season incentive', async function () {
        await setToSecondsAfterHour(30)
        await beanstalk.connect(owner).sunrise();
        expect(await bean.balanceOf(owner.address)).to.be.equal('3809203')
    })

    it('300 seconds after season incentive', async function () {
        await setToSecondsAfterHour(300)
        await beanstalk.connect(owner).sunrise();
        expect(await bean.balanceOf(owner.address)).to.be.equal('59365398')
    })

    it('1500 seconds after season incentive', async function () {
        await setToSecondsAfterHour(1500)
        await beanstalk.connect(owner).sunrise();
        expect(await bean.balanceOf(owner.address)).to.be.equal('59365398')
    })
})