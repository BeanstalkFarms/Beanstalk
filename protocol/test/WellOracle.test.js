const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { getAltBeanstalk, getBean, getUsdc } = require('../utils/contracts.js');
const { toBN } = require('../utils/index.js');
const { mintBeans, mintUsdc } = require('../utils/mint.js');
const { readEmaAlpha } = require('../utils/read.js');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, USDC, WETH } = require('./utils/constants');
const { getEma } = require('./utils/ema.js');
const { TypeEncoder } = require('./utils/encoder.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
let timestamp;

async function getTimestamp() {
  return (await ethers.provider.getBlock('latest')).timestamp
}

async function fastForward(seconds = 1000) {
  // await network.provider.send("evm_increaseTime", [seconds])
  await network.provider.send("evm_setNextBlockTimestamp", [(await getTimestamp()) + seconds])
}

async function getCumulative(amount) {
  return (await getTimepassed()).mul(amount)
}

async function getTimepassed() {
  return ethers.BigNumber.from(`${(await getTimestamp()) - timestamp}`)
}

describe('Well', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    typeParams = TypeEncoder.constantProductType()
    this.beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address)
    this.bean = await getBean()
    this.usdc = await getUsdc()

    A = toBN(await readEmaAlpha())

    await this.bean.mint(user.address, to6('1000'))
    await this.bean.mint(user2.address, to6('100000'))
    await this.usdc.mint(user.address, to6('1000'))
    await this.usdc.mint(user2.address, to6('100000'))

    await this.bean.connect(user2).approve(this.beanstalk.address, to18('1'))
    await this.bean.connect(user).approve(this.beanstalk.address, to18('1'))
    await this.usdc.connect(user2).approve(this.beanstalk.address, to18('1'))
    await this.usdc.connect(user).approve(this.beanstalk.address, to18('1'))

    wellId = await this.beanstalk.callStatic.buildWell([USDC, BEAN], '0', typeParams, ['USDC', 'BEAN'])
    well = {
      wellId: wellId, 
      tokens: [USDC, BEAN], 
      data: await this.beanstalk.encodeWellData(0, 2, '0x')
    }
    wellHash = await this.beanstalk.computeWellHash(well)
  
    buildWellResult = await this.beanstalk.buildWell([USDC, BEAN], '0', typeParams, ['USDC', 'BEAN'])
    this.lp = await ethers.getContractAt('WellToken', wellId)
    await this.lp.connect(user).approve(this.beanstalk.address, to18('100000000'))
    await this.lp.connect(user2).approve(this.beanstalk.address, to18('100000000'))

    await this.beanstalk.connect(user2).addLiquidity(well, [to6('100'), to6('100')], to6('200'), EXTERNAL, EXTERNAL)
    timestamp = await getTimestamp();

    await this.beanstalk.connect(owner).whitelistToken(wellId, '0xebc4d079', 10000, 4, true, '0x00000000000000000000000000000001')
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Gets LP Value", async function () {
    it("Get instant LP Value", async function () {
      expect(await this.beanstalk.getInstantLPValue(wellId, to6('1'), toBN('0'))).to.be.equal(to6('1'))
      expect(await this.beanstalk.getInstantLPValue(wellId, to6('1'), '1')).to.be.equal(to6('1'))
    })
  })

  describe("Gets BDV", async function () {
    it("Gets BDV", async function () {
      expect(await this.beanstalk.callStatic.bdv(wellId, to6('1'))).to.be.equal(to6('1'))
    })
  })
})