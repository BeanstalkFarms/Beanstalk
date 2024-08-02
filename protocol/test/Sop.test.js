const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_ETH_WELL, WETH, MAX_UINT256, ZERO_ADDRESS, BEAN_WSTETH_WELL, WSTETH } = require('./utils/constants')
const { to18, to6, advanceTime } = require('./utils/helpers.js')
const { deployMockWell, whitelistWell, deployMockWellWithMockPump } = require('../utils/well.js');
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { setEthUsdChainlinkPrice } = require('../utils/oracle.js')

let user,user2,user3,owner;
let userAddress, ownerAddress, user2Address, user3Address;

describe('Sop', function () {
  before(async function () {
    [owner,user,user2,user3] = await ethers.getSigners()
    userAddress = user.address;
    user2Address = user2.address;
    user3Address = user3.address;
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.seasonGetters = await ethers.getContractAt('SeasonGettersFacet', this.diamond.address)
    this.siloGetters = await ethers.getContractAt('SiloGettersFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('Bean', BEAN)
    this.weth = await ethers.getContractAt('MockToken', WETH)

    this.season.deployStemsUpgrade();
    
    await this.season.siloSunrise(0)


    await this.bean.connect(user).approve(this.silo.address, '100000000000')
    await this.bean.connect(user2).approve(this.silo.address, '100000000000') 
    await this.bean.mint(userAddress, to6('10000'))
    await this.bean.mint(user2Address, to6('10000'));

    // init wells
    [this.well, this.wellFunction, this.pump] = await deployMockWellWithMockPump()
    await deployMockWellWithMockPump(BEAN_WSTETH_WELL, WSTETH)
    await this.well.connect(owner).approve(this.diamond.address, to18('100000000'))
    await this.well.connect(user).approve(this.diamond.address, to18('100000000'))

    // set reserves at a 1000:1 ratio.
    await this.pump.setCumulativeReserves([to6('1000000'), to18('1000')])
    await this.well.mint(ownerAddress, to18('500'))
    await this.well.mint(userAddress, to18('500'))
    await whitelistWell(this.well.address, '10000', to6('4'));
    await this.season.siloSunrise(0)
    await this.season.captureWellE(this.well.address);

    await setEthUsdChainlinkPrice('1000')

    this.result = await this.silo.connect(user).deposit(this.bean.address, to6('1000'), EXTERNAL)
    this.result = await this.silo.connect(user2).deposit(this.bean.address, to6('1000'), EXTERNAL)

    // call sunrise twice to skip germination. 
    await this.season.siloSunrise(0)
    await this.season.siloSunrise(0)

    // update user 1 and 2's deposit so that they have roots. (users do not get roots until 
    // they have updated their deposit at least once after silo sunrise)
    await this.silo.mow(userAddress, this.bean.address);
    await this.silo.mow(user2Address, this.bean.address);
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  
  describe("bug report", async function () {
    it("lost plenty 2", async function () {
      const beanStem = to6("4");

      //rain sunrise
      await this.season.rainSunrise(); // start raining
      await this.silo.mow(user.address, BEAN);
      
      // rain sunrise
      await this.season.rainSunrise(); // still raining, no sop
      await this.silo.mow(user.address, BEAN); // lastUpdated = rainStart + 1

      // set reserves so next season plenty is accrued
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves([to6("1000000"), to18("1100")]);

      await this.season.rainSunrise(); // 1st actual sop

      await this.silo.mow(user.address, BEAN); // this will do nothing as lastUpdated > rainStart

      await this.season.rainSunrise();
      await this.season.rainSunrise();
      
      await this.season.droughtSunrise();
      await this.season.droughtSunrise();

      await this.silo.connect(user).withdrawDeposit(BEAN, beanStem, to6("1000"), EXTERNAL);

      await this.season.rainSunrise();
      await this.silo.mow(user.address, BEAN);

      const userPlenty = await this.siloGetters.balanceOfPlenty(user.address);
      expect(userPlenty).to.be.equal("25595575914848452999");
    });
  });

  describe("Rain", async function () {
    it("Not raining", async function () {
      const season = await this.seasonGetters.time()
      expect(season.raining).to.be.equal(false)
    })

    it("Raining", async function () {
      await this.field.incrementTotalPodsE(to18('100'))
      await this.season.rainSunrise()
      await this.silo.mow(userAddress, this.bean.address);
      const rain = await this.seasonGetters.rain()
      const season = await this.seasonGetters.time()
      expect(season.rainStart).to.be.equal(season.current)
      expect(season.raining).to.be.equal(true)
      expect(rain.pods).to.be.equal(await this.field.totalPods())
      // roots are slightly higher than 2 as 2 seasons need to pass
      // until the roots are accounted for.
      expect(rain.roots).to.be.equal('20008000000000000000000000')
      const userRain = await this.siloGetters.balanceOfSop(userAddress);
      expect(userRain.lastRain).to.be.equal(season.rainStart);
      expect(userRain.roots).to.be.equal('10004000000000000000000000');
    })

    it("Stops raining", async function () {
      await this.field.incrementTotalPodsE(to18('100'))
      await this.season.rainSunrise()
      await this.silo.mow(userAddress, this.bean.address);
      await this.season.droughtSunrise()
      await this.silo.mow(userAddress, this.bean.address);
      const season = await this.seasonGetters.time()
      expect(season.rainStart).to.be.equal(season.current - 1)
      const userRain = await this.siloGetters.balanceOfSop(userAddress);
      expect(userRain.lastRain).to.be.equal(0);
    })
  })

  describe('Sop when P <= 1', async function () {
    it('sops p = 1', async function () {
      await this.season.rainSunrises(25);
      const season = await this.seasonGetters.time();
      const rain = await this.seasonGetters.rain()
      expect(season.lastSop).to.be.equal(0);
      expect(season.lastSopSeason).to.be.equal(0);
    })

    it('sops p < 1', async function () {
      // set reserves st p < 1, elapse time for pump to update.
      await this.well.setReserves([to6('1100000'), to18('1000')])
      await advanceTime(3600)
      await this.season.rainSunrises(25);
      const season = await this.seasonGetters.time();
      const rain = await this.seasonGetters.rain()
      expect(season.lastSop).to.be.equal(0);
      expect(season.lastSopSeason).to.be.equal(0);
    })
  })

  describe('1 sop', async function () {
    beforeEach(async function () {
      // verify sop well is not initialized in storage prior to sop.
      expect(await this.seasonGetters.getSopWell()).to.be.equal(ZERO_ADDRESS)
      // set reserves/pump P > 1.
      // `setReserves` updates the values in the well,
      // `setInstantaneousReserves` updates the values in the pump.
      await this.well.setReserves([to6('1000000'), to18('1100')])
      await this.pump.setInstantaneousReserves([to6('1000000'), to18('1100')])
      await this.season.rainSunrise();
      await this.silo.mow(user2Address, this.bean.address);
      await this.season.rainSunrise();

      
    })

    it('sops p > 1', async function () {
      const season = await this.seasonGetters.time();
      const reserves = await this.well.getReserves();

      expect(season.lastSop).to.be.equal(season.rainStart);
      expect(season.lastSopSeason).to.be.equal(await this.seasonGetters.season());
      expect(await this.weth.balanceOf(this.silo.address)).to.be.equal(to18('51.191151829696906017'))
      // after the swap, the composition of the pools are
      expect(reserves[0]).to.be.equal(to6('1048808.848170'))
      expect(reserves[1]).to.be.equal(to18('1048.808848170303093983'))

    })

    it('tracks user plenty before update', async function () {
      expect(await this.siloGetters.connect(user).balanceOfPlenty(userAddress)).to.be.equal('25595575914848452999')
    })

    it('tracks user plenty after update', async function () {
      await this.silo.mow(userAddress, this.well.address);
      const userSop = await this.siloGetters.balanceOfSop(userAddress);
      expect(userSop.lastRain).to.be.equal(6)
      expect(userSop.lastSop).to.be.equal(6)
      expect(userSop.roots).to.be.equal('10004000000000000000000000')
      expect(userSop.plenty).to.be.equal(to18('25.595575914848452999'))
      expect(userSop.plentyPerRoot).to.be.equal('2558534177813719812')
    })

    // each user should get half of the eth gained. 
    it('tracks user2 plenty', async function () {
      expect(await this.siloGetters.connect(user).balanceOfPlenty(user2Address)).to.be.equal(to18('25.595575914848452999'))
    })

    it('tracks user2 plenty after update', async function () {
      await this.silo.mow(user2Address, this.well.address);
      const userSop = await this.siloGetters.balanceOfSop(user2Address);
      expect(userSop.lastRain).to.be.equal(6)
      expect(userSop.lastSop).to.be.equal(6)
      expect(userSop.roots).to.be.equal('10004000000000000000000000')
      expect(userSop.plenty).to.be.equal(to18('25.595575914848452999'))
      expect(userSop.plentyPerRoot).to.be.equal('2558534177813719812')
    })

    it('claims user plenty', async function () {
      await this.silo.mow(user2Address, this.well.address);
      await this.silo.connect(user2).claimPlenty();
      expect(await this.siloGetters.balanceOfPlenty(user2Address)).to.be.equal('0')
      expect(await this.weth.balanceOf(user2Address)).to.be.equal(to18('25.595575914848452999'))
    })
    
    it('changes the sop well', async function () {
      expect(await this.seasonGetters.getSopWell()).to.be.equal(this.well.address)
    })
  })

  describe('multiple sop', async function () {
    beforeEach(async function () {
      
      await this.well.setReserves([to6('1000000'), to18('1100')])
      await this.pump.setInstantaneousReserves([to6('1000000'), to18('1100')])
      await this.season.rainSunrise();
      await this.silo.mow(user2Address, this.bean.address);
      await this.season.rainSunrise();
      await this.season.droughtSunrise();
      await this.well.setReserves([to6('1048808.848170'), to18('1100')])
      await this.pump.setInstantaneousReserves([to6('1048808.848170'), to18('1100')])
      await this.season.rainSunrises(2);
    })

    it('sops p > 1', async function () {
      const season = await this.seasonGetters.time();
      const reserves = await this.well.getReserves();
      expect(season.lastSop).to.be.equal(season.rainStart);
      expect(season.lastSopSeason).to.be.equal(await this.seasonGetters.season());
      expect(await this.weth.balanceOf(this.silo.address)).to.be.equal('77091653184968908600')
      // after the swap, the composition of the pools are
      expect(reserves[0]).to.be.equal(to6('1074099.498643'))
      expect(reserves[1]).to.be.equal(to18('1074.099498644727997417'))
    })

    it('tracks user plenty before update', async function () {
      expect(await this.siloGetters.connect(user).balanceOfPlenty(userAddress)).to.be.equal('38544532214605630101')
    })

    it('tracks user plenty after update', async function () {
      await this.silo.mow(userAddress, this.well.address);
      const userSop = await this.siloGetters.balanceOfSop(userAddress);
      expect(userSop.lastRain).to.be.equal(9)
      expect(userSop.lastSop).to.be.equal(9)
      expect(userSop.roots).to.be.equal('10004000000000000000000000')
      expect(userSop.plenty).to.be.equal('38544532214605630101')
      expect(userSop.plentyPerRoot).to.be.equal('3852912056637907847')
    })

    it('tracks user2 plenty', async function () {
      expect(await this.siloGetters.connect(user).balanceOfPlenty(user2Address)).to.be.equal('38547120970363278477')
    })

    it('tracks user2 plenty after update', async function () {
      await this.silo.mow(user2Address, this.well.address);
      await this.silo.mow(user2Address, this.bean.address);
      const userSop = await this.siloGetters.balanceOfSop(user2Address);
      expect(userSop.lastRain).to.be.equal(9)
      expect(userSop.lastSop).to.be.equal(9)
      expect(userSop.roots).to.be.equal('10006000000000000000000000')
      expect(userSop.plenty).to.be.equal('38547120970363278477')
      expect(userSop.plentyPerRoot).to.be.equal('3852912056637907847')
    })
  })

  describe('sop with current balances', async function () {
    beforeEach(async function () {
      // verify sop well is not initialized in storage prior to sop.
      expect(await this.seasonGetters.getSopWell()).to.be.equal(ZERO_ADDRESS)

      // the sop can use either the current or isntanteous reserves,
      // depending on which one issues less beans.
      // this test confirms the current reserves are used.
      await this.well.setReserves([to6('1000000'), to18('1100')])
      await this.pump.setInstantaneousReserves([to6('900000'), to18('1100')])
      await this.season.rainSunrise();
      await this.silo.mow(user2Address, this.bean.address);
      await this.season.rainSunrise();
    })

    it('sops p > 1', async function () {
      const season = await this.seasonGetters.time();
      const reserves = await this.well.getReserves();

      expect(season.lastSop).to.be.equal(season.rainStart);
      expect(season.lastSopSeason).to.be.equal(await this.seasonGetters.season());
      expect(await this.weth.balanceOf(this.silo.address)).to.be.equal(to18('51.191151829696906017'))
      // after the swap, the composition of the pools are
      expect(reserves[0]).to.be.equal(to6('1048808.848170'))
      expect(reserves[1]).to.be.equal(to18('1048.808848170303093983'))

    })

    it('tracks user plenty before update', async function () {
      expect(await this.siloGetters.connect(user).balanceOfPlenty(userAddress)).to.be.equal('25595575914848452999')
    })

    it('tracks user plenty after update', async function () {
      await this.silo.mow(userAddress, this.well.address);
      const userSop = await this.siloGetters.balanceOfSop(userAddress);
      expect(userSop.lastRain).to.be.equal(6)
      expect(userSop.lastSop).to.be.equal(6)
      expect(userSop.roots).to.be.equal('10004000000000000000000000')
      expect(userSop.plenty).to.be.equal(to18('25.595575914848452999'))
      expect(userSop.plentyPerRoot).to.be.equal('2558534177813719812')
    })

    // each user should get half of the eth gained. 
    it('tracks user2 plenty', async function () {
      expect(await this.siloGetters.connect(user).balanceOfPlenty(user2Address)).to.be.equal(to18('25.595575914848452999'))
    })

    it('tracks user2 plenty after update', async function () {
      await this.silo.mow(user2Address, this.well.address);
      const userSop = await this.siloGetters.balanceOfSop(user2Address);
      expect(userSop.lastRain).to.be.equal(6)
      expect(userSop.lastSop).to.be.equal(6)
      expect(userSop.roots).to.be.equal('10004000000000000000000000')
      expect(userSop.plenty).to.be.equal(to18('25.595575914848452999'))
      expect(userSop.plentyPerRoot).to.be.equal('2558534177813719812')
    })

    it('claims user plenty', async function () {
      await this.silo.mow(user2Address, this.well.address);
      await this.silo.connect(user2).claimPlenty();
      expect(await this.siloGetters.balanceOfPlenty(user2Address)).to.be.equal('0')
      expect(await this.weth.balanceOf(user2Address)).to.be.equal(to18('25.595575914848452999'))
    })
    
    it('changes the sop well', async function () {
      expect(await this.seasonGetters.getSopWell()).to.be.equal(this.well.address)
    })
  })

  describe('Rain roots reduced', function () {
    it('reduces rain roots upon withdrawal', async function () {
      const beanStem = to6("4");

      // set reserves so we'll sop
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves([to6("1000000"), to18("1100")]);

      await this.season.rainSunrise(); // start raining
      await this.season.rainSunrise(); // sop

      await this.silo.mow(user.address, BEAN);

      let rainRoots = await this.siloGetters.balanceOfRainRoots(userAddress);

      expect(rainRoots).to.be.equal('10004000000000000000000000');

      await this.silo.connect(user).withdrawDeposit(BEAN, beanStem, to6('1000'), EXTERNAL);

      rainRoots = await this.siloGetters.balanceOfRainRoots(userAddress);

      expect(await this.siloGetters.balanceOfRainRoots(userAddress)).to.be.equal('0');
    });

    it('stops raining and withdraw test', async function () {
      const beanStem = to6("4");

      const depositAmount = to6('50000');
      await this.bean.mint(user3Address, depositAmount);
      await this.bean.connect(user3).approve(this.silo.address, MAX_UINT256);
      await this.silo.connect(user3).deposit(BEAN, depositAmount, EXTERNAL);

      // log current bean stemTip
      const stemTip = await this.siloGetters.stemTipForToken(BEAN);
      console.log("stemTip: ", stemTip);

      // pass germination
      await this.season.siloSunrise(0);
      await this.season.siloSunrise(0);


      // set reserves so we'll sop
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves([to6("1000000"), to18("1100")]);

      await this.season.rainSunrise(); // start raining

      await this.silo.mow(user3Address, BEAN);

      let rainRoots = await this.siloGetters.balanceOfRainRoots(user3Address);
      expect(rainRoots).to.be.equal('500000000000000000000000000');

      // stop raining
      await this.season.droughtSunrise();

      // withdraw
      await this.silo.connect(user3).withdrawDeposit(BEAN, stemTip, to6('50000'), EXTERNAL);
      rainRoots = await this.siloGetters.balanceOfRainRoots(user3Address);
      // rain roots zero after withdrawing deposit
      expect(rainRoots).to.be.equal('0');

      // start raining again
      await this.season.rainSunrise();
      await this.season.rainSunrise();
      await this.silo.mow(user3Address, BEAN);
      rainRoots = await this.siloGetters.balanceOfRainRoots(user3Address);
      expect(rainRoots).to.be.equal('0');

      // measure user actual roots
      const userRoots = await this.siloGetters.balanceOfRoots(user3Address);
      expect(userRoots).to.be.equal('0');
    });

    it('burns rain roots upon transfer', async function () {
      const beanStem = to6("4");

      // set reserves so we'll sop
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves([to6("1000000"), to18("1100")]);

      await this.season.rainSunrise(); // start raining
      await this.season.rainSunrise(); // sop

      await this.silo.mow(user.address, BEAN);

      let rainRootsBefore = await this.siloGetters.balanceOfRainRoots(userAddress);

      expect(rainRootsBefore).to.be.equal('10004000000000000000000000');

      await this.silo.connect(user).transferDeposit(userAddress, user3Address, BEAN, beanStem, to6('1000'));
      await this.silo.mow(user.address, BEAN);

      // user should have 0 rain roots
      expect(await this.siloGetters.balanceOfRainRoots(userAddress)).to.be.equal('0');
      // user3 should have 0 rain roots, none transferred
      expect(await this.siloGetters.balanceOfRainRoots(user3Address)).to.be.equal('0');
    });

    it('burns rain half of roots upon half transfer', async function () {
      const beanStem = to6("4");

      // set reserves so we'll sop
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves([to6("1000000"), to18("1100")]);

      await this.season.rainSunrise(); // start raining
      await this.season.rainSunrise(); // sop

      await this.silo.mow(user.address, BEAN);

      let rainRootsBefore = await this.siloGetters.balanceOfRainRoots(userAddress);

      expect(rainRootsBefore).to.be.equal('10004000000000000000000000');

      await this.silo.connect(user).transferDeposit(userAddress, user3Address, BEAN, beanStem, to6('500'));
      await this.silo.mow(user.address, BEAN);

      // user should have half rain roots
      expect(await this.siloGetters.balanceOfRainRoots(userAddress)).to.be.equal('5004000000000000000000000');
    });

    it('does not burn rain roots upon transfer if extra roots available', async function () {
      const beanStem = to6("4");

      // set reserves so we'll sop
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves([to6("1000000"), to18("1100")]);

      await this.season.rainSunrise(); // start raining
      await this.season.rainSunrise(); // sop

      await this.silo.mow(user.address, BEAN);

      let rainRootsBefore = await this.siloGetters.balanceOfRainRoots(userAddress);

      expect(rainRootsBefore).to.be.equal('10004000000000000000000000');

      // do another deposit
      await this.silo.connect(user).deposit(BEAN, to6('1000'), EXTERNAL);

      // pass germination
      await this.season.siloSunrise(0);
      await this.season.siloSunrise(0);

      // verify roots went up
      expect(await this.siloGetters.balanceOfRoots(userAddress)).to.be.equal('20008000000000000000000000');
      // verify rain roots stayed the same
      expect(await this.siloGetters.balanceOfRainRoots(userAddress)).to.be.equal('10004000000000000000000000');

      // then transfer
      await this.silo.connect(user).transferDeposit(userAddress, user3Address, BEAN, beanStem, to6('500'));
      await this.silo.mow(user.address, BEAN);

      // user should have full rain roots, since they had non-rain roots that could be removed before
      expect(await this.siloGetters.balanceOfRainRoots(userAddress)).to.be.equal('10004000000000000000000000');
    });

    it('germination rain roots test', async function () {
      // user 3 deposits a bunch of bean

      const depositAmount = to6('50000');
      await this.bean.mint(user3Address, depositAmount);
      await this.bean.connect(user3).approve(this.silo.address, MAX_UINT256);
      await this.silo.connect(user3).deposit(this.bean.address, depositAmount, EXTERNAL);

      // set reserves so we'll sop
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves([to6("1000000"), to18("1100")]);

      await this.season.rainSunrise(); // start raining

      // log current total rain roots and current total roots
      let totalRainRoots = await this.siloGetters.totalRainRoots();
      console.log("totalRainRoots: ", totalRainRoots);

      let totalRoots = await this.siloGetters.totalRoots();
      console.log("totalRoots: ", totalRoots);


      await this.season.rainSunrise(); // sop

      await this.silo.mow(user3Address, BEAN);

      let totalRainRoots2 = await this.siloGetters.totalRainRoots();
      console.log("2 totalRainRoots: ", totalRainRoots2);

      let userRainRoots = await this.siloGetters.balanceOfRainRoots(user3Address);
      console.log("userRainRoots: ", userRainRoots);

      // shouldn't be a way for a user to get more rain roots than total rain roots
      // couldn't find a way to do lessThan without importing something else that supports BigNumber from chai
      expect(userRainRoots.lt(totalRainRoots2)).to.be.true;
    });

    // verifies that total rain roots are not affected by anything deposited after raining starts
    it('second germination rain roots test', async function () {

      await this.season.rainSunrise(); // start raining

      let totalRainRootsBefore = await this.siloGetters.totalRainRoots();

      const depositAmount = to6('50000');
      await this.bean.mint(user3Address, depositAmount);
      await this.bean.connect(user3).approve(this.silo.address, MAX_UINT256);
      await this.silo.connect(user3).deposit(this.bean.address, depositAmount, EXTERNAL);
      // set reserves so we'll sop
      await this.well.setReserves([to6("1000000"), to18("1100")]);
      await this.pump.setInstantaneousReserves([to6("1000000"), to18("1100")]);


      await this.season.rainSunrise(); // sop

      await this.silo.mow(user3Address, BEAN);

      let totalRainRootsAfter = await this.siloGetters.totalRainRoots();

      // rain roots before should equal rain roots after, anything deposited after raining doesn't count
      expect(totalRainRootsBefore).to.be.equal(totalRainRootsAfter);

      let userRainRoots = await this.siloGetters.balanceOfRainRoots(user3Address);

      // assert that user rain roots are zero
      expect(userRainRoots).to.be.equal('0');

      // shouldn't be a way for a user to get more rain roots than total rain roots
      // couldn't find a way to do lessThan without importing something else that supports BigNumber from chai
      expect(userRainRoots.lt(totalRainRootsAfter)).to.be.true;
    });
  })

  describe('Germination and Plenty', function () {
    it('not germinated', async function () {
      
      await this.bean.mint(user3Address, to6('10000'));
      await this.bean.connect(user3).approve(this.silo.address, MAX_UINT256);
      await this.silo.connect(user3).deposit(this.bean.address, to6('1000'), EXTERNAL);
      
      await this.season.siloSunrise(0);
      await this.season.siloSunrise(0);
      await this.season.siloSunrise(0); // should be germinated by now, not mown though
      
      await this.well.setReserves([to6('1000000'), to18('1100')])
      await this.pump.setInstantaneousReserves([to6('1000000'), to18('1100')])


      await this.season.rainSunrise();
      await this.season.rainSunrise();

      await this.silo.mow(user3Address, this.bean.address);
      
      const balanceOfPlenty = await this.siloGetters.balanceOfPlenty(user3Address);
      expect(balanceOfPlenty).to.equal('17059168165054954010');
    });

    it('germinated', async function () {
      await this.bean.mint(user3Address, to6('10000'));
      await this.bean.connect(user3).approve(this.silo.address, MAX_UINT256);
      await this.silo.connect(user3).deposit(this.bean.address, to6('1000'), EXTERNAL);
      
      await this.season.siloSunrise(0);
      await this.season.siloSunrise(0);
      await this.season.siloSunrise(0); // should be germinated by now, not mown though
      
      await this.well.setReserves([to6('1000000'), to18('1100')]);
      await this.pump.setInstantaneousReserves([to6('1000000'), to18('1100')])

      await this.silo.mow(user3Address, this.bean.address);
      await this.season.rainSunrise();
      await this.season.rainSunrise();
      await this.silo.mow(user3Address, this.bean.address);
      
      const balanceOfPlenty = await this.siloGetters.balanceOfPlenty(user3Address);
      // Note user has more plenty here than previous test because of the earlier mow, giving them more stalk
      expect(balanceOfPlenty).to.equal('17065991377622017778');
    });
  });
})