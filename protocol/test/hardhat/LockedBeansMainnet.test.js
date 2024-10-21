const {
  BEAN,
  UNRIPE_BEAN,
  UNRIPE_LP,
  BEAN_ETH_WELL,
  BARN_RAISE_WELL,
  BEANSTALK,
  WSTETH
} = require("./utils/constants.js");
const { EXTERNAL, INTERNAL } = require("./utils/balances.js");
const { impersonateSigner, impersonateBeanstalkOwner } = require("../../utils/signer.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot.js");
const { getBeanstalk } = require("../../utils/contracts.js");
const { upgradeWithNewFacets } = require("../../scripts/diamond");
const { bipMiscellaneousImprovements } = require("../../scripts/bips.js");
const { migrateBeanEthToBeanWSteth } = require("../../scripts/beanWstethMigration.js");
const { impersonateWsteth } = require("../../scripts/impersonate.js");
const { to6, to18 } = require("./utils/helpers.js");
const { mintEth } = require("../../utils");
const { ethers } = require("hardhat");
const { expect } = require("chai");

let user, user2, owner;

let snapshotId;

// The test can be skipped, given that the miscellaneous bip improvements has already been deployed.
describe.skip("LockedBeansMainnet", function () {
  before(async function () {
    [user, user2] = await ethers.getSigners();

    try {
      await network.provider.request({
        method: "hardhat_reset",
        params: [
          {
            forking: {
              jsonRpcUrl: process.env.FORKING_RPC,
              blockNumber: 20375900
            }
          }
        ]
      });
    } catch (error) {
      console.log("forking error in seed Gauge");
      console.log(error);
      return;
    }

    this.beanstalk = await getBeanstalk();
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  /**
   * the following tests are performed prior to the seed gauge deployment.
   * upon the bips passing, the tests should be updated to the latest block and omit the seed gauge update.
   */
  describe("chopRate change:", async function () {
    it("correctly updates chop", async function () {
      // check chop rate:
      expect(await this.beanstalk.getPercentPenalty(UNRIPE_BEAN)).to.eq(to6("0.013271"));
      expect(await this.beanstalk.getPercentPenalty(UNRIPE_LP)).to.eq(to6("0.013264"));

      // simulate a urBean chop:
      address = await impersonateSigner("0xef764bac8a438e7e498c2e5fccf0f174c3e3f8db");
      snapshotId = await takeSnapshot();
      await this.beanstalk
        .connect(address)
        .withdrawDeposit(UNRIPE_BEAN, "-28418000000", to6("1"), INTERNAL);
      await this.beanstalk.connect(address).chop(UNRIPE_BEAN, to6("1"), INTERNAL, EXTERNAL);
      expect(await this.beanstalk.getExternalBalance(address.address, BEAN)).to.eq(to6("0.013271"));
      await revertToSnapshot(snapshotId);

      // simulate a urLP chop:
      await this.beanstalk
        .connect(address)
        .withdrawDeposit(UNRIPE_LP, "-33292000000", to6("1"), INTERNAL);
      await this.beanstalk.connect(address).chop(UNRIPE_LP, to6("1"), INTERNAL, EXTERNAL);
      expect(await this.beanstalk.getExternalBalance(address.address, BEAN_ETH_WELL)).to.eq(
        to18("0.000164043206705975")
      );
      await revertToSnapshot(snapshotId);

      // migrate bean eth to bean wsteth:
      this.wsteth = await ethers.getContractAt("MockWsteth", WSTETH);
      const stethPerToken = await this.wsteth.stEthPerToken();
      await impersonateWsteth();
      await this.wsteth.setStEthPerToken(stethPerToken);
      await migrateBeanEthToBeanWSteth();

      // deploy misc. improvements bip:
      await bipMiscellaneousImprovements(true, undefined, false);

      // check chop rate:
      expect(await this.beanstalk.getPercentPenalty(UNRIPE_BEAN)).to.eq(to6("0.050552"));
      expect(await this.beanstalk.getPercentPenalty(UNRIPE_LP)).to.eq(to6("0.050526"));

      // simulate a urBean chop:
      snapshotId = await takeSnapshot();
      await this.beanstalk
        .connect(address)
        .withdrawDeposit(UNRIPE_BEAN, "-28418000000", to6("1"), INTERNAL);
      await this.beanstalk.connect(address).chop(UNRIPE_BEAN, to6("1"), INTERNAL, EXTERNAL);
      expect(await this.beanstalk.getExternalBalance(address.address, BEAN)).to.eq(to6("0.050552"));
      await revertToSnapshot(snapshotId);

      // // simulate a urLP chop:
      let initialBeanEthBal = await this.beanstalk.getExternalBalance(
        address.address,
        BARN_RAISE_WELL
      );
      await this.beanstalk
        .connect(address)
        .withdrawDeposit(UNRIPE_LP, "-33292000000", to6("1"), INTERNAL);
      await this.beanstalk.connect(address).chop(UNRIPE_LP, to6("1"), INTERNAL, EXTERNAL);
      let newBeanEthBal = await this.beanstalk.getExternalBalance(address.address, BARN_RAISE_WELL);
      // beanEthBal should increase by ~4.94x the original chop rate.
      expect(newBeanEthBal - initialBeanEthBal).to.eq(to18("0.000576793427336659"));
    });
  });

  describe("lockedBeans change", async function () {
    it("correctly updates locked beans", async function () {
      // deploy mockUnripeFacet, as `getLockedBeans()` was updated:
      account = await impersonateBeanstalkOwner();
      await mintEth(account.address);
      await upgradeWithNewFacets({
        diamondAddress: BEANSTALK,
        facetNames: ["MockUnripeFacet"],
        libraryNames: ["LibLockedUnderlying"],
        facetLibraries: {
          MockUnripeFacet: ["LibLockedUnderlying"]
        },
        selectorsToRemove: [],
        bip: false,
        object: false,
        verbose: false,
        account: account,
        verify: false
      });
      // check underlying locked beans and locked LP:
      this.unripe = await ethers.getContractAt("MockUnripeFacet", BEANSTALK);
      expect(await this.unripe.getLegacyLockedUnderlyingBean()).to.eq(to6("22073747.489499"));
      expect(await this.unripe.getLegacyLockedUnderlyingLP()).to.be.within(
        to18("198522"),
        to18("198600")
      );

      // migrate bean eth to bean wsteth:
      this.wsteth = await ethers.getContractAt("MockWsteth", WSTETH);
      const stethPerToken = await this.wsteth.stEthPerToken();
      await impersonateWsteth();
      await this.wsteth.setStEthPerToken(stethPerToken);
      await migrateBeanEthToBeanWSteth();

      // mine blocks + update timestamp for pumps to update:
      for (let i = 0; i < 100; i++) {
        await ethers.provider.send("evm_increaseTime", [12]);
        await ethers.provider.send("evm_mine");
      }

      // call sunrise:
      await this.beanstalk.sunrise();

      for (let i = 0; i < 100; i++) {
        await ethers.provider.send("evm_increaseTime", [12]);
        await ethers.provider.send("evm_mine");
      }

      // deploy misc. improvements bip
      await bipMiscellaneousImprovements(true, undefined, false);

      // check underlying locked beans and locked LP:
      expect(await this.beanstalk.getLockedBeansUnderlyingUnripeBean()).to.eq(
        to6("15397373.979201")
      );
      expect(await this.beanstalk.getLockedBeansUnderlyingUnripeLP()).to.be.within(
        "8372544877445",
        "8372546877445"
      );
    });
  });
});
