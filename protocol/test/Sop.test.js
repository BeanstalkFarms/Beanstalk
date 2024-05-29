const { expect } = require("chai");
const { deploy } = require("../scripts/deploy.js");
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require("./utils/balances.js");
const {
  BEAN,
  BEAN_ETH_WELL,
  WETH,
  MAX_UINT256,
  ZERO_ADDRESS,
  BEAN_WSTETH_WELL,
  WSTETH
} = require("./utils/constants");
const { to18, to6, advanceTime } = require("./utils/helpers.js");
const { deployMockWell, whitelistWell, deployMockWellWithMockPump } = require("../utils/well.js");
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot");
const {
  setStethEthChainlinkPrice,
  setWstethEthUniswapPrice,
  setEthUsdChainlinkPrice
} = require("../utils/oracle.js");
const { getAllBeanstalkContracts } = require("../utils/contracts.js");

let user, user2, owner;

describe("Sop", function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners();

    const contracts = await deploy((verbose = false), (mock = true), (reset = true));
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;

    // `beanstalk` contains all functions that the regualar beanstalk has.
    // `mockBeanstalk` has functions that are only available in the mockFacets.
    [beanstalk, mockBeanstalk] = await getAllBeanstalkContracts(this.diamond.address);

    bean = await ethers.getContractAt("Bean", BEAN);
    this.weth = await ethers.getContractAt("MockToken", WETH);

    mockBeanstalk.deployStemsUpgrade();

    await mockBeanstalk.siloSunrise(0);

    await bean.connect(user).approve(beanstalk.address, "100000000000");
    await bean.connect(user2).approve(beanstalk.address, "100000000000");
    await bean.mint(user.address, to6("10000"));
    await bean.mint(user2.address, to6("10000"));

    // init wells
    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump();
    await deployMockWellWithMockPump(BEAN_WSTETH_WELL, WSTETH);
    await this.well.connect(owner).approve(this.diamond.address, to18("100000000"));
    await this.well.connect(user).approve(this.diamond.address, to18("100000000"));

    // set reserves at a 1000:1 ratio.
    await this.pump.setCumulativeReserves(this.well.address, [to6("1000000"), to18("1000")]);
    await this.well.mint(ownerAddress, to18("500"));
    await this.well.mint(user.address, to18("500"));
    await mockBeanstalk.siloSunrise(0);
    await mockBeanstalk.captureWellE(this.well.address);

    await setEthUsdChainlinkPrice("1000");
    await setStethEthChainlinkPrice("1000");
    await setStethEthChainlinkPrice("1");
    await setWstethEthUniswapPrice("1");

    await beanstalk.connect(user).deposit(bean.address, to6("1000"), EXTERNAL);
    await beanstalk.connect(user2).deposit(bean.address, to6("1000"), EXTERNAL);

    // call sunrise twice to skip germination.
    await mockBeanstalk.siloSunrise(0);
    await mockBeanstalk.siloSunrise(0);

    // update user 1 and 2's deposit so that they have roots. (users do not get roots until
    // they have updated their deposit at least once after silo sunrise)
    await beanstalk.mow(user.address, bean.address);
    await beanstalk.mow(user2.address, bean.address);
  });

  beforeEach(async function () {
    snapshotId = await takeSnapshot();
  });

  afterEach(async function () {
    await revertToSnapshot(snapshotId);
  });

  describe("Rain", async function () {
    it("Not raining", async function () {
      const season = await beanstalk.time();
      expect(season.raining).to.be.equal(false);
    });

    it("Raining", async function () {
      await mockBeanstalk.incrementTotalPodsE(0, to18("100"));
      await mockBeanstalk.rainSunrise();
      await beanstalk.mow(user.address, bean.address);
      const rain = await beanstalk.rain();
      const season = await beanstalk.time();
      expect(season.rainStart).to.be.equal(season.current);
      expect(season.raining).to.be.equal(true);
      expect(rain.pods).to.be.equal(await beanstalk.totalPods(0));
      // roots are slightly higher than 2 as 2 seasons need to pass
      // until the roots are accounted for.
      expect(rain.roots).to.be.equal("20008000000000000000000000");
      const userRain = await beanstalk.balanceOfSop(user.address);
      expect(userRain.lastRain).to.be.equal(season.rainStart);
      expect(userRain.roots).to.be.equal("10004000000000000000000000");
    });

    it("Stops raining", async function () {
      await mockBeanstalk.incrementTotalPodsE(0, to18("100"));
      await mockBeanstalk.rainSunrise();
      await beanstalk.mow(user.address, bean.address);
      await mockBeanstalk.droughtSunrise();
      await beanstalk.mow(user.address, bean.address);
      const season = await beanstalk.time();
      expect(season.rainStart).to.be.equal(season.current - 1);
      const userRain = await beanstalk.balanceOfSop(user.address);
      expect(userRain.lastRain).to.be.equal(0);
    });
  });

  describe("Sop when P <= 1", async function () {
    it("sops p = 1", async function () {
      await mockBeanstalk.rainSunrises(25);
      const season = await beanstalk.time();
      const rain = await beanstalk.rain();
      expect(season.lastSop).to.be.equal(0);
      expect(season.lastSopSeason).to.be.equal(0);
    });

    it("sops p < 1", async function () {
      // set reserves st p < 1, elapse time for pump to update.
      await this.well.setReserves([to6("1100000"), to18("1000")]);
      await advanceTime(3600);
      await mockBeanstalk.rainSunrises(25);
      const season = await beanstalk.time();
      const rain = await beanstalk.rain();
      expect(season.lastSop).to.be.equal(0);
      expect(season.lastSopSeason).to.be.equal(0);
    });
  });

  describe("1 sop", async function () {
    beforeEach(async function () {
      // verify sop well is not initalized in storage prior to sop.
      // set reserves/pump P > 1.
      // `setReserves` updates the values in the well,
      // `setInstantaneousReserves` updates the values in the pump.
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves(this.well.address, [to6("1000000"), to18("1100")]);
      await mockBeanstalk.rainSunrise();
      await beanstalk.mow(user2.address, bean.address);
      await mockBeanstalk.rainSunrise();
    });

    it("sops p > 1", async function () {
      const season = await beanstalk.time();
      const reserves = await this.well.getReserves();

      expect(season.lastSop).to.be.equal(season.rainStart);
      expect(season.lastSopSeason).to.be.equal(await beanstalk.season());
      expect(await this.weth.balanceOf(beanstalk.address)).to.be.equal(
        to18("51.191151829696906017")
      );
      // after the swap, the composition of the pools are
      expect(reserves[0]).to.be.equal(to6("1048808.848170"));
      expect(reserves[1]).to.be.equal(to18("1048.808848170303093983"));
    });

    it("tracks user plenty before update", async function () {
      expect(await beanstalk.connect(user).balanceOfPlenty(user.address, this.well.address)).to.be.equal(
        "25595575914848452999"
      );
    });

    it("tracks user plenty after update", async function () {
      await beanstalk.mow(user.address, this.well.address);
      const userSop = await beanstalk.balanceOfSop(user.address);
      expect(userSop.lastRain).to.be.equal(6);
      expect(userSop.lastSop).to.be.equal(6);
      expect(userSop.roots).to.be.equal("10004000000000000000000000");
      expect(userSop.farmerSops[0].wellsPlenty.plenty).to.be.equal(to18("25.595575914848452999"));
      expect(userSop.farmerSops[0].wellsPlenty.plentyPerRoot).to.be.equal("2558534177813719812");
    });

    // each user should get half of the eth gained.
    it("tracks user2 plenty", async function () {
      expect(await beanstalk.connect(user).balanceOfPlenty(user2.address, this.well.address)).to.be.equal(
        to18("25.595575914848452999")
      );
    });

    it("tracks user2 plenty after update", async function () {
      await beanstalk.mow(user2.address, this.well.address);
      const userSop = await beanstalk.balanceOfSop(user2.address);
      expect(userSop.lastRain).to.be.equal(6);
      expect(userSop.lastSop).to.be.equal(6);
      expect(userSop.roots).to.be.equal("10004000000000000000000000");
      expect(userSop.farmerSops[0].wellsPlenty.plenty).to.be.equal(to18("25.595575914848452999"));
      expect(userSop.farmerSops[0].wellsPlenty.plentyPerRoot).to.be.equal("2558534177813719812");
    });

    it("claims user plenty", async function () {
      await beanstalk.mow(user2.address, this.well.address);
      await beanstalk.connect(user2).claimPlenty(this.well.address, EXTERNAL);
      expect(await beanstalk.balanceOfPlenty(user2.address, this.well.address)).to.be.equal('0')
      expect(await this.weth.balanceOf(user2.address)).to.be.equal(to18('25.595575914848452999'))
    })
  })

  describe("multiple sop", async function () {
    beforeEach(async function () {
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves(this.well.address, [to6("1000000"), to18("1100")]);
      await mockBeanstalk.rainSunrise();
      await beanstalk.mow(user2.address, bean.address);
      await mockBeanstalk.rainSunrise();
      await mockBeanstalk.droughtSunrise();
      await this.well.setReserves([to6("1048808.848170"), to18("1100")]);
      await this.pump.setInstantaneousReserves(this.well.address, [
        to6("1048808.848170"),
        to18("1100")
      ]);
      await mockBeanstalk.rainSunrises(2);
    });

    it("sops p > 1", async function () {
      const season = await beanstalk.time();
      const reserves = await this.well.getReserves();
      expect(season.lastSop).to.be.equal(season.rainStart);
      expect(season.lastSopSeason).to.be.equal(await beanstalk.season());
      expect(await this.weth.balanceOf(beanstalk.address)).to.be.equal("77091653184968908600");
      // after the swap, the composition of the pools are
      expect(reserves[0]).to.be.equal(to6("1074099.498643"));
      expect(reserves[1]).to.be.equal(to18("1074.099498644727997417"));
    });

    it("tracks user plenty before update", async function () {
      expect(await beanstalk.connect(user).balanceOfPlenty(user.address, this.well.address)).to.be.equal(
        "38544532214605630101"
      );
    });

    it("tracks user plenty after update", async function () {
      await beanstalk.mow(user.address, this.well.address);
      const userSop = await beanstalk.balanceOfSop(user.address);
      expect(userSop.lastRain).to.be.equal(9);
      expect(userSop.lastSop).to.be.equal(9);
      expect(userSop.roots).to.be.equal("10004000000000000000000000");
      expect(userSop.farmerSops[0].wellsPlenty.plenty).to.be.equal("38544532214605630101");
      expect(userSop.farmerSops[0].wellsPlenty.plentyPerRoot).to.be.equal("3852912056637907847");
    });

    it("tracks user2 plenty", async function () {
      expect(await beanstalk.connect(user).balanceOfPlenty(user2.address, this.well.address)).to.be.equal(
        "38547120970363278477"
      );
    });

    it("tracks user2 plenty after update", async function () {
      await beanstalk.mow(user2.address, this.well.address);
      await beanstalk.mow(user2.address, bean.address);
      const userSop = await beanstalk.balanceOfSop(user2.address);
      expect(userSop.lastRain).to.be.equal(9);
      expect(userSop.lastSop).to.be.equal(9);
      expect(userSop.roots).to.be.equal("10006000000000000000000000");
      expect(userSop.farmerSops[0].wellsPlenty.plenty).to.be.equal("38547120970363278477");
      expect(userSop.farmerSops[0].wellsPlenty.plentyPerRoot).to.be.equal("3852912056637907847");
    });
  });

  describe("sop with current balances", async function () {
    beforeEach(async function () {

      // the sop can use either the current or isntanteous reserves,
      // depending on which one issues less beans.
      // this test confirms the current reserves are used.
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves(this.well.address, [to6("900000"), to18("1100")]);
      await mockBeanstalk.rainSunrise();
      await beanstalk.mow(user2.address, bean.address);
      await mockBeanstalk.rainSunrise();
    });

    it("sops p > 1", async function () {
      const season = await beanstalk.time();
      const reserves = await this.well.getReserves();

      expect(season.lastSop).to.be.equal(season.rainStart);
      expect(season.lastSopSeason).to.be.equal(await beanstalk.season());
      expect(await this.weth.balanceOf(beanstalk.address)).to.be.equal(
        to18("51.191151829696906017")
      );
      // after the swap, the composition of the pools are
      expect(reserves[0]).to.be.equal(to6("1048808.848170"));
      expect(reserves[1]).to.be.equal(to18("1048.808848170303093983"));
    });

    it("tracks user plenty before update", async function () {
      expect(await beanstalk.connect(user).balanceOfPlenty(user.address, this.well.address)).to.be.equal(
        "25595575914848452999"
      );
    });

    it("tracks user plenty after update", async function () {
      await beanstalk.mow(user.address, this.well.address);
      const userSop = await beanstalk.balanceOfSop(user.address);
      expect(userSop.lastRain).to.be.equal(6);
      expect(userSop.lastSop).to.be.equal(6);
      expect(userSop.roots).to.be.equal("10004000000000000000000000");
      expect(userSop.farmerSops[0].wellsPlenty.plenty).to.be.equal(to18("25.595575914848452999"));
      expect(userSop.farmerSops[0].wellsPlenty.plentyPerRoot).to.be.equal("2558534177813719812");
    });

    // each user should get half of the eth gained.
    it("tracks user2 plenty", async function () {
      expect(await beanstalk.connect(user).balanceOfPlenty(user2.address, this.well.address)).to.be.equal(
        to18("25.595575914848452999")
      );
    });

    it("tracks user2 plenty after update", async function () {
      await beanstalk.mow(user2.address, this.well.address);
      const userSop = await beanstalk.balanceOfSop(user2.address);
      expect(userSop.lastRain).to.be.equal(6);
      expect(userSop.lastSop).to.be.equal(6);
      expect(userSop.roots).to.be.equal("10004000000000000000000000");
      expect(userSop.farmerSops[0].wellsPlenty.plenty).to.be.equal(to18("25.595575914848452999"));
      expect(userSop.farmerSops[0].wellsPlenty.plentyPerRoot).to.be.equal("2558534177813719812");
    });

    it("claims user plenty", async function () {
      await beanstalk.mow(user2.address, this.well.address);
      await beanstalk.connect(user2).claimPlenty(this.well.address, EXTERNAL);
      expect(await beanstalk.balanceOfPlenty(user2.address, this.well.address)).to.be.equal('0')
      expect(await this.weth.balanceOf(user2.address)).to.be.equal(to18('25.595575914848452999'))
    })
  })
})
