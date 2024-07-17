const { BEAN, UNRIPE_BEAN, UNRIPE_LP, BEAN_ETH_WELL, BEANSTALK } = require('./utils/constants.js');
const { EXTERNAL, INTERNAL } = require('./utils/balances.js')
const { impersonateSigner, impersonateBeanstalkOwner } = require('../utils/signer.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { getBeanstalk } = require('../utils/contracts.js');
const { upgradeWithNewFacets } = require("../scripts/diamond");
const { bipSeedGauge, bipMiscellaneousImprovements } = require('../scripts/bips.js');
const { to6, to18 } = require('./utils/helpers.js');
const { mintEth } = require('../utils')
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
    })
  })

  describe("lockedBeans change", async function() {
    it("correctly updates locked beans", async function () {
      // deploy mockUnripeFacet, as `getLockedBeans()` was updated: 
      account = await impersonateBeanstalkOwner();
      await mintEth(account.address);
      await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: [
          'MockUnripeFacet'
        ],
        libraryNames: [
          'LibLockedUnderlying'
        ],
        facetLibraries: {
          'MockUnripeFacet': [
            'LibLockedUnderlying'
          ]
        },
        selectorsToRemove: [],
        bip: false,
        object: false,
        verbose: false,
        account: account,
        verify: false
      })
      // check underlying locked beans and locked LP:
      this.unripe = await ethers.getContractAt('MockUnripeFacet', BEANSTALK)
      expect(await this.unripe.getLegacyLockedUnderlyingBean()).to.eq(to6('22034476.333100'))
      // expect(await this.unripe.getLegacyLockedUnderlyingLP()).to.be.within(to18('158853'),to18('158855'))
      expect(await this.unripe.getLegacyLockedUnderlyingLP()).to.be.within(to18('208398'),to18('208400'))

      // deploy misc. improvements bip
      await bipMiscellaneousImprovements(true, undefined, false)

      // check underlying locked beans and locked LP:
      expect(await this.beanstalk.getLockedBeansUnderlyingUnripeBean()).to.eq(to6('14978575.114249'))
      expect(await this.beanstalk.getLockedBeansUnderlyingUnripeLP()).to.be.within('7668288289687','7868288289687')
    })
  })
})