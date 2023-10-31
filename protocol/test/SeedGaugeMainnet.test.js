const { expect } = require('chai');
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { BEAN, BEAN_3_CURVE, UNRIPE_BEAN, UNRIPE_LP, WETH, BEANSTALK, BEAN_ETH_WELL } = require('./utils/constants.js');
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
let user,user2,owner;

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
              blockNumber: 18467677 //a random semi-recent block close to Grown Stalk Per Bdv pre-deployment
            },
          },
        ],
      });
    } catch(error) {
      console.log('forking error in seed Gauge');
      console.log(error);
      return
    }

    this.beanstalk = await getBeanstalk()

    // seed Gauge
    await bipSeedGauge(true, undefined, false)
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
      expect(await this.beanstalk.getAverageGrownStalkPerBdvPerSeason()).to.be.equal(to6('4.803472'));
    })

    it('average Grown Stalk Per BDV', async function() {
      // average is 2.07 grown stalk per BDV
      // note: should change with updated BDVs
      expect(await this.beanstalk.getAverageGrownStalkPerBdv()).to.be.equal(20751);
    })

    it('totalBDV', async function () {
      // ~44m total BDV
      expect(await this.beanstalk.getTotalBdv()).to.be.within(to6('44100000.000000'), to6('44300000.000000'));
    })

    it('L2SR', async function () {
      // the L2SR may differ during testing, due to the fact 
      // that the L2SR is calculated on twa reserves, and thus may slightly differ due to 
      // timestamp differences.
      expect(await this.beanstalk.getLiquidityToSupplyRatio()).to.be.within(to18('1.14'), to18('1.15'));
    })
    
    it('bean To MaxLPGpRatio', async function () {
      expect(await this.beanstalk.getBeanToMaxLpGpPerBdvRatio()).to.be.equal(to18('33.333333333333333333'));
      expect(await this.beanstalk.getBeanToMaxLpGpPerBdvRatioScaled()).to.be.equal(to18('66.666666666666666666'));
    })

    it('lockedBeans', async function () {
      // ~25.5m locked beans, ~35.8m total beans
      expect(await this.beanstalk.getLockedBeans()).to.be.within(to6('25600000.000000'), to6('25700000.000000'));
    })

    it('usd Liquidity', async function () {
      // ~10.8m usd liquidity in Bean:Eth
      expect(await this.beanstalk.getBeanEthTwaUsdLiquidity()).to.be.within(to18('12350000'), to18('12450000'));
      // ~111k usd liquidity in bean3crv 
      expect(await this.beanstalk.getBean3CRVLiquidity()).to.be.within(to18('111000'), to18('112000'))
    // ~11.13m usd liquidity total
      expect(await this.beanstalk.getTotalUsdLiquidity()).to.be.within(to18('12400000'), to18('12500000'));
    })

    it('gaugePoints', async function () {
      expect(await this.beanstalk.getGaugePoints(BEAN_ETH_WELL)).to.be.equal(to18('2250'));
      expect(await this.beanstalk.getGaugePoints(BEAN_3_CURVE)).to.be.equal(to18('1625'));
    })
  })

})