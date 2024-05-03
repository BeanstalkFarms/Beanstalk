const { BEAN, BEAN_3_CURVE, STABLE_FACTORY, UNRIPE_BEAN, UNRIPE_LP, BEANSTALK, BEAN_ETH_WELL } = require('./utils/constants.js');
const { EXTERNAL, INTERNAL } = require('./utils/balances.js')
const { impersonateBeanstalkOwner, impersonateSigner } = require('../utils/signer.js');
const { time, mine } = require("@nomicfoundation/hardhat-network-helpers");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { getBeanstalk } = require('../utils/contracts.js');
const { bipSeedGauge, bipMiscellaneousImprovements } = require('../scripts/bips.js');
const { to6, to18 } = require('./utils/helpers.js');
const { ethers } = require('hardhat');
const { expect } = require('chai');

let user,user2, owner;

let snapshotId


describe('LockedBeansMainnet', function () {
  before(async function () {

    [user, user2] = await ethers.getSigners()
    

    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 19785088 //a random semi-recent block close to Grown Stalk Per Bdv pre-deployment
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
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  });

  /**
   * the following tests are performed prior to the seed gauge deployment.
   * upon the bips passing, the tests should be updated to the latest block and omit the seed gauge update.
   */
  describe("chopRate change:", async function() {
    it("correctly updates chop", async function () {
      // check chop rate:
      expect(await this.beanstalk.getPercentPenalty(UNRIPE_BEAN)).to.eq(to6('0.010227'))
      expect(await this.beanstalk.getPercentPenalty(UNRIPE_LP)).to.eq(to6('0.010215'))

      // simulate a urBean chop: 
      address = await impersonateSigner('0xef764bac8a438e7e498c2e5fccf0f174c3e3f8db')
      snapshotId = await takeSnapshot()
      await this.beanstalk.connect(address).withdrawDeposit(
        UNRIPE_BEAN,
        '-28418',
        to6('1'),
        INTERNAL
      );
      await this.beanstalk.connect(address).chop(
        UNRIPE_BEAN,
        to6('1'),
        INTERNAL,
        EXTERNAL
      )
      expect(await this.beanstalk.getExternalBalance(address.address, BEAN)).to.eq(to6('0.010226'))
      await revertToSnapshot(snapshotId)

      // simulate a urLP chop: 
      await this.beanstalk.connect(address).withdrawDeposit(
        UNRIPE_LP,
        '-33292',
        to6('1'),
        INTERNAL
      );
      await this.beanstalk.connect(address).chop(
        UNRIPE_LP,
        to6('1'),
        INTERNAL,
        EXTERNAL
      )
      expect(await this.beanstalk.getExternalBalance(address.address, BEAN_ETH_WELL)).to.eq(to18('0.000126330680297571'))
      await revertToSnapshot(snapshotId)

      // deploy seed gauge
      await bipSeedGauge(true, undefined, false)

      // // deploy misc. improvements bip
      await bipMiscellaneousImprovements(true, undefined, false)

      // check chop rate:
      expect(await this.beanstalk.getPercentPenalty(UNRIPE_BEAN)).to.eq(to6('0.050532'))
      expect(await this.beanstalk.getPercentPenalty(UNRIPE_LP)).to.eq(to6('0.050473'))

      // simulate a urBean chop: 
      snapshotId = await takeSnapshot()
      await this.beanstalk.connect(address).withdrawDeposit(
        UNRIPE_BEAN,
        '-28418000000', // scaled by 1e6 due to silo v3.1.
        to6('1'),
        INTERNAL
      );
      await this.beanstalk.connect(address).chop(
        UNRIPE_BEAN,
        to6('1'),
        INTERNAL,
        EXTERNAL
      )
      expect(await this.beanstalk.getExternalBalance(address.address, BEAN)).to.eq(to6('0.050532'))
      await revertToSnapshot(snapshotId)

      // // simulate a urLP chop:
      let initialBeanEthBal = await this.beanstalk.getExternalBalance(address.address, BEAN_ETH_WELL)
      await this.beanstalk.connect(address).withdrawDeposit(
        UNRIPE_LP,
        '-33292000000',
        to6('1'),
        INTERNAL
      );
      await this.beanstalk.connect(address).chop(
        UNRIPE_LP,
        to6('1'),
        INTERNAL,
        EXTERNAL
      )
      let newBeanEthBal = await this.beanstalk.getExternalBalance(address.address, BEAN_ETH_WELL)
      // beanEthBal should increase by ~4.94x the original chop rate.
      expect(newBeanEthBal-initialBeanEthBal).to.eq(to18('0.000624219026576969'))
      await revertToSnapshot(snapshotId)
    })
  })

  describe("lockedBeans change", async function() {
    it("correctly updates locked beans", async function () {
       // deploy seed gauge
      await bipSeedGauge(true, undefined, false)

      // check locked beans:
      expect(await this.beanstalk.getLockedBeans()).to.eq(to6('5553152.377928'))

      // deploy misc. improvements bip
      await bipMiscellaneousImprovements(true, undefined, false)

      // check locked beans:
      expect(await this.beanstalk.getLockedBeans()).to.eq(to6('5553152.377928'))
    })
  })
})