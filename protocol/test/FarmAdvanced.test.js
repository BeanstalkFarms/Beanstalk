const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js');
const { deployPipeline, impersonatePipeline, } = require('../scripts/pipeline.js');
const { getAltBeanstalk, getBean, getUsdc } = require('../utils/contracts.js');
const { toBN, encodeAdvancedData } = require('../utils/index.js');
const { impersonateSigner } = require('../utils/signer.js');
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js');
const { BEAN_3_CURVE, THREE_POOL, THREE_CURVE, STABLE_FACTORY, WETH, ZERO_ADDRESS } = require('./utils/constants.js');
const { to6, to18 } = require('./utils/helpers.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");

let user, user2, owner;
let userAddress, ownerAddress, user2Address;
let timestamp;

async function getTimestamp() {
  return (await ethers.provider.getBlock('latest')).timestamp
}

async function getTimepassed() {
  return ethers.BigNumber.from(`${(await getTimestamp()) - timestamp}`)
}

describe('Farm Advanced', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    this.beanstalk = await getAltBeanstalk(contracts.beanstalkDiamond.address)
    this.bean = await getBean()
    this.usdc = await getUsdc()
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE)
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL)
    this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE)
    this.weth = await ethers.getContractAt("MockWETH", WETH)

    const account = impersonateSigner('0x533545dE45Bd44e6B5a6D649256CCfE3b6E1abA6')
    pipeline = await impersonatePipeline(account)

    this.mockContract = await (await ethers.getContractFactory('MockContract', owner)).deploy()
    await this.mockContract.deployed()
    await this.mockContract.setAccount(user2.address)

    await this.bean.mint(user.address, to6('1000'))
    await this.usdc.mint(user.address, to6('1000'))

    await this.bean.connect(user).approve(this.beanstalk.address, to18('1'))
    await this.usdc.connect(user).approve(this.beanstalk.address, to18('1'))

    await this.bean.connect(user).approve(this.beanstalk.address, '100000000000')
    await this.bean.connect(user).approve(this.beanMetapool.address, '100000000000')
    await this.bean.mint(userAddress, to6('10000'))

    await this.threeCurve.mint(userAddress, to18('1000'))
    await this.threePool.set_virtual_price(to18('1'))
    await this.threeCurve.connect(user).approve(this.beanMetapool.address, to18('100000000000'))

    await this.beanMetapool.set_A_precise('1000')
    await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'))
    await this.beanMetapool.connect(user).approve(this.threeCurve.address, to18('100000000000'))
    await this.beanMetapool.connect(user).approve(this.beanstalk.address, to18('100000000000'))
    await this.threeCurve.connect(user).approve(this.beanstalk.address, to18('100000000000'))
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  it('reverts if non-existent type', async function () {
    selector = this.beanstalk.interface.encodeFunctionData('sunrise', [])
    data = encodeAdvancedData(9)
    await expect(this.beanstalk.connect(user).advancedFarm(
      [[selector, data]]
    )).to.be.revertedWith('Function: Advanced Type not supported')
  })
                      
  describe("1 Return data", async function () {
    beforeEach(async function () {
      await this.beanstalk.connect(user).transferToken(this.bean.address, user.address, to6('100'), 0, 1)
      selector = this.beanstalk.interface.encodeFunctionData('getInternalBalance', [user.address, this.bean.address])
      data = encodeAdvancedData(0)
      selector2 = this.beanstalk.interface.encodeFunctionData('transferToken', [this.bean.address, user2.address, to6('0'), 1, 1])
      // [read from 0th return value, copy from 32nd byte result, paste starting from 100th byte]
      data2 = encodeAdvancedData(1, value = to6('0'), [0, 32, 100])
      await this.beanstalk.connect(user).advancedFarm([
        [selector, data],
        [selector2, data2]
      ])
    })

    it("Transfers Beans to user internal", async function () {
      expect(await this.beanstalk.getInternalBalance(user.address, this.bean.address)).to.be.equal(toBN('0'))
      expect(await this.beanstalk.getInternalBalance(user2.address, this.bean.address)).to.be.equal(to6('100'))
    })
  })

  describe("Multiple return data", async function () {
    beforeEach(async function () {
      await this.beanstalk.connect(user).transferToken(this.bean.address, user.address, to6('100'), 0, 1)
      selector = this.beanstalk.interface.encodeFunctionData('getInternalBalance', [user.address, this.bean.address])
      pipe = this.mockContract.interface.encodeFunctionData('getAccount', [])
      selector2 = this.beanstalk.interface.encodeFunctionData('readPipe', [[this.mockContract.address, pipe]])
      data12 = encodeAdvancedData(0)
      selector3 = this.beanstalk.interface.encodeFunctionData('transferToken', [this.bean.address, ZERO_ADDRESS, to6('0'), 1, 1])
      data3 = encodeAdvancedData(2, toBN('0'), [[0, 32, 100], [1, 96, 68]])
      await this.beanstalk.connect(user).advancedFarm([
        [selector, data12],
        [selector2, data12],
        [selector3, data3]
      ])
    })

    it("Transfers Beans to user internal", async function () {
      expect(await this.beanstalk.getInternalBalance(user.address, this.bean.address)).to.be.equal(toBN('0'))
      expect(await this.beanstalk.getInternalBalance(user2.address, this.bean.address)).to.be.equal(to6('100'))
    })
  })
})