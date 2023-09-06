const { expect } = require('chai');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { BEAN, FERTILIZER, USDC, BEAN_3_CURVE, THREE_CURVE, UNRIPE_BEAN, UNRIPE_LP, WETH, BEANSTALK, BEAN_ETH_WELL, BCM, STABLE_FACTORY } = require('./utils/constants.js');
const { setEthUsdcPrice, setEthUsdPrice } = require('../utils/oracle.js');
const { to6, to18 } = require('./utils/helpers.js');
const { bipMigrateUnripeBean3CrvToBeanEth } = require('../scripts/bips.js');
const { getBeanstalk } = require('../utils/contracts.js');
const { impersonateBeanstalkOwner } = require('../utils/signer.js');
const { ethers } = require('hardhat');
const { mintEth } = require('../utils/mint.js');
let user,user2,owner;

let underlyingBefore
let beanEthUnderlying
let snapshotId


describe('Bean:3Crv to Bean:Eth Migration', function () {
  before(async function () {

    [user, user2] = await ethers.getSigners()

    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 18072000 //a random semi-recent block close to Grown Stalk Per Bdv pre-deployment
            },
          },
        ],
      });
    } catch(error) {
      console.log('forking error in Silo V3: Grown Stalk Per Bdv:');
      console.log(error);
      return
    }

    owner = await impersonateBeanstalkOwner()
    this.beanstalk = await getBeanstalk()
    this.weth = await ethers.getContractAt('IWETH', WETH)
    this.bean = await ethers.getContractAt('IBean', BEAN)
    this.beanEth = await ethers.getContractAt('IWell', BEAN_ETH_WELL)
    this.beanEthToken = await ethers.getContractAt('IERC20', BEAN_ETH_WELL)
    this.unripeLp = await ethers.getContractAt('IERC20', UNRIPE_LP)
    this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE)
    underlyingBefore = await this.beanstalk.getTotalUnderlying(UNRIPE_LP);

    await bipMigrateUnripeBean3CrvToBeanEth(true, undefined, false)
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  });

  describe('Initializes migration', async function () {
    it('Changings underlying token', async function () {
      expect(await this.beanstalk.getUnderlyingToken(UNRIPE_LP)).to.be.equal(BEAN_ETH_WELL)
    })
  
    it('Removes underlying balance', async function () { 
      expect(await this.beanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(0)
    })
  
    it('Sends underlying balance to BCM', async function () {
      expect(await this.beanstalk.getExternalBalance(BCM, BEAN_3_CURVE)).to.be.equal(underlyingBefore)
    })
  })

  describe('Completes Migration', async function () {
    beforeEach(async function () {
      const balance = await this.beanMetapool.balanceOf(owner.address)
      await this.beanMetapool.connect(owner).approve(BEANSTALK, balance)
      await this.beanstalk.connect(owner).removeLiquidity(
        BEAN_3_CURVE,
        STABLE_FACTORY,
        balance,
        ['0', '0'],
        '0',
        '0'
      )
      const balances = await this.beanEth.getReserves();
      const beans = await this.bean.balanceOf(owner.address)
      const weth = beans.mul(balances[1]).div(balances[0])
      await this.weth.connect(owner).deposit({value: weth})

      await this.weth.connect(owner).approve(BEAN_ETH_WELL, weth)
      await this.bean.connect(owner).approve(BEAN_ETH_WELL, beans)

      await this.beanEth.connect(owner).addLiquidity(
        [beans, weth],
        0,
        owner.address,
        ethers.constants.MaxUint256
      );
      beanEthUnderlying = await this.beanEthToken.balanceOf(owner.address)
      await this.beanEthToken.connect(owner).approve(BEANSTALK, beanEthUnderlying)
      await this.beanstalk.connect(owner).addMigratedUnderlying(UNRIPE_LP, beanEthUnderlying);
    })

    it("successfully adds underlying", async function () {
      expect(await this.beanstalk.getTotalUnderlying(UNRIPE_LP)).to.be.equal(beanEthUnderlying)
      expect(await this.beanstalk.getUnderlying(UNRIPE_LP, await this.unripeLp.totalSupply())).to.be.equal(beanEthUnderlying)
    })
  })
})