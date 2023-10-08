const { expect } = require('chai');
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { BEAN, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP, WETH, BEANSTALK, BEAN_ETH_WELL, STABLE_FACTORY, PUBLIUS, ETH_USD_CHAINLINK_AGGREGATOR } = require('./utils/constants.js');
const { setEthUsdcPrice, setEthUsdPrice } = require('../utils/oracle.js');
const { to6, to18 } = require('./utils/helpers.js');
const { bipSeedGauge } = require('../scripts/bips.js');
const { migrateBean3CrvToBeanEth } = require('../scripts/beanEthMigration.js');
const { getBeanstalk } = require('../utils/contracts.js');
const { impersonateBeanstalkOwner, impersonateSigner } = require('../utils/signer.js');
const { ethers } = require('hardhat');
const { mintEth, mintBeans } = require('../utils/mint.js');
const { ConvertEncoder } = require('./utils/encoder.js');
const { setReserves } = require('../utils/well.js');
const { toBN } = require('../utils/helpers.js');
const { impersonateBean, impersonateEthUsdChainlinkAggregator} = require('../scripts/impersonate.js');
let user,user2,owner;
let publius;

let underlyingBefore
let beanEthUnderlying
let snapshotId


describe('SeedGauge Init Test', function () {
  before(async function () {

    [user, user2] = await ethers.getSigners()

    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 18261800 //a random semi-recent block close to Grown Stalk Per Bdv pre-deployment
            },
          },
        ],
      });
    } catch(error) {
      console.log('forking error in seed Gauge');
      console.log(error);
      return
    }

    publius = await impersonateSigner(PUBLIUS, true)
    await impersonateEthUsdChainlinkAggregator()
    await impersonateBean()


    owner = await impersonateBeanstalkOwner()
    this.beanstalk = await getBeanstalk()
    this.well = await ethers.getContractAt('IWell', BEAN_ETH_WELL);
    this.weth = await ethers.getContractAt('IWETH', WETH)
    this.bean = await ethers.getContractAt('IBean', BEAN)
    this.beanEth = await ethers.getContractAt('IWell', BEAN_ETH_WELL)
    this.beanEthToken = await ethers.getContractAt('IERC20', BEAN_ETH_WELL)
    this.unripeLp = await ethers.getContractAt('IERC20', UNRIPE_LP)
    this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE)
    this.chainlink = await ethers.getContractAt('MockChainlinkAggregator', ETH_USD_CHAINLINK_AGGREGATOR)
    underlyingBefore = await this.beanstalk.getTotalUnderlying(UNRIPE_LP);



    // migrate Bean3CRV to BeanEth
    await migrateBean3CrvToBeanEth()

    // seed Gauge
    await bipSeedGauge(true, undefined, false)

    // mine some blocks so that reserves can be updated: 
    await mine(10000, { interval: 12 });
    // update curve oracle
    await this.beanstalk.connect(owner).removeLiquidity(
      BEAN_3_CURVE,
      STABLE_FACTORY,
      [0, 0],
      ['0', '0'],
      '0',
      '0'
    )
    // update pump.
    await this.well.connect(owner).addLiquidity(
      [0 , 0],
      '0',
      owner.address,
      ethers.constants.MaxUint256
    )

    // set chainlink price (10000 blocks exceeds the timeout parameter)
    await this.chainlink.addRound(
      1732380493, // price at block 18261800
      await time.latest(),
      await time.latest(), 
      await this.chainlink.getLatestRoundId()
    )
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  });

  describe('init state', async function () {

    // TODO: add check once un-migrated bdvs are verified.
    it('totalDepositedBDV', async function () {
      console.log(await this.beanstalk.getTotalDepositedBdv(BEAN));
      console.log(await this.beanstalk.getTotalDepositedBdv(BEAN_3_CURVE));
      console.log(await this.beanstalk.getTotalDepositedBdv(BEAN_ETH_WELL));
      console.log(await this.beanstalk.getTotalDepositedBdv(UNRIPE_BEAN));
      console.log(await this.beanstalk.getTotalDepositedBdv(UNRIPE_LP));
    })

    it('average grown stalk per BDV per Season', async function () {
      expect(await this.beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6('4.989583'));
    })

    it('average Grown Stalk Per BDV', async function() {
      // average is 2.1 grown stalk per BDV
      expect(await this.beanstalk.getAverageGrownStalkPerBdv()).to.be.equal(21555);
    })

    it('totalBDV', async function () {
      // 41m total BDV
      expect(await this.beanstalk.getTotalBdv()).to.be.equal(to6('41775374.728500'));
    })

    it('L2SR', async function () {
      // lmao 254% L2SR
      // the L2SR may differ during testing, due to the fact 
      // that the L2SR is calculated on twa reserves, and thus may slightly differ due to 
      // timestamp differences.
      expect(await this.beanstalk.getLiquidityToSupplyRatio()).to.be.within(to18('2.2590'), to18('2.2591'));
    })
    
    it('bean To MaxLPGpRatio', async function () {
      expect(await this.beanstalk.getBeanToMaxLpGPperBDVRatio()).to.be.equal(to18('50'));
      expect(await this.beanstalk.getBeanToMaxLpGPperBDVRatioScaled()).to.be.equal(to18('75'));
    })

    it('lockedBeans', async function () {
      // ~31m locked beans, ~35.8m total beans
      expect(await this.beanstalk.getLockedBeans()).to.be.equal(to6('31239123.637132'));
    })

    it('usd Liquidity', async function () {
      // ~11.5m usd liquidity in Bean:Eth
      expect(await this.beanstalk.getBeanEthTwaUsdLiquidity()).to.be.within(to18('10227446'), to18('10227789'));
      // ~118k usd liquidity in Bean3Crv
      expect(await this.beanstalk.getBean3CRVLiquidity()).to.be.equal(to18('118929.150867709373771440'));
      // ~11.6m usd liquidity total
      expect(await this.beanstalk.getTotalUsdLiquidity()).to.be.within(to18('10346700'), to18('10347100'));
    })

    it('gaugePoints', async function () {
      expect(await this.beanstalk.getGaugePoints(BEAN_ETH_WELL)).to.be.equal(to18('95'));
      expect(await this.beanstalk.getGaugePoints(BEAN_3_CURVE)).to.be.equal(to18('5'));
    })
  })

})