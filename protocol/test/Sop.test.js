const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { BEAN, THREE_CURVE, THREE_POOL, BEAN_3_CURVE } = require('./utils/constants')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('Sop', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners()
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.seasonGetters = await ethers.getContractAt('SeasonGettersFacet', this.diamond.address)
    this.siloGetters = await ethers.getContractAt('SiloGettersFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('Bean', BEAN)
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE)
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL)
    this.beanMetapool = await ethers.getContractAt('IMockCurvePool', BEAN_3_CURVE)

    this.season.deployStemsUpgrade();
    
    await this.season.siloSunrise(0)


    await this.bean.connect(user).approve(this.silo.address, '100000000000')
    await this.bean.connect(user2).approve(this.silo.address, '100000000000') 
    await this.bean.connect(user).approve(this.beanMetapool.address, '100000000000')
    await this.bean.mint(userAddress, to6('10000'))
    await this.bean.mint(user2Address, to6('10000'))

    await this.threeCurve.mint(userAddress, to18('100000'))
    await this.threePool.set_virtual_price(to18('1'))
    await this.threeCurve.connect(user).approve(this.beanMetapool.address, to18('100000000000'))

    await this.beanMetapool.set_A_precise('1000')
    await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'))
    await this.beanMetapool.connect(user).approve(this.threeCurve.address, to18('100000000000'))
    await this.beanMetapool.connect(user).approve(this.silo.address, to18('100000000000'))
    await this.beanMetapool.connect(user).add_liquidity([to6('1000'), to18('1000')], to18('2000'))
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
      await this.beanMetapool.connect(user).add_liquidity([to6('100'), to18('0')], to18('50'))
      await this.season.rainSunrises(25);
      const season = await this.seasonGetters.time();
      const rain = await this.seasonGetters.rain()
      expect(season.lastSop).to.be.equal(0);
      expect(season.lastSopSeason).to.be.equal(0);
    })
  })

  describe('1 sop', async function () {
    beforeEach(async function () {
      await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('50'))
      await this.season.rainSunrise();
      await this.silo.mow(user2Address, this.bean.address);
      await this.season.rainSunrise();
    })

    it('sops p > 1', async function () {
      const season = await this.seasonGetters.time();
      const balances = await this.beanMetapool.get_balances()
      const scaledBalance1 = balances[1].div(ethers.utils.parseEther('0.000001'));
      expect(balances[0]).to.be.within(scaledBalance1.sub(1),scaledBalance1.add(1))
      expect(season.lastSop).to.be.equal(season.rainStart);
      expect(season.lastSopSeason).to.be.equal(await this.seasonGetters.season());
      expect(await this.threeCurve.balanceOf(this.silo.address)).to.be.equal('100416214692705624318')
    })

    it('tracks user plenty before update', async function () {
      expect(await this.siloGetters.connect(user).balanceOfPlenty(userAddress)).to.be.equal('50208107346352812154')
    })

    it('tracks user plenty after update', async function () {
      await this.silo.mow(userAddress, this.beanMetapool.address);
      const userSop = await this.siloGetters.balanceOfSop(userAddress);
      expect(userSop.lastRain).to.be.equal(5)
      expect(userSop.lastSop).to.be.equal(5)
      expect(userSop.roots).to.be.equal('10004000000000000000000000')
      expect(userSop.plenty).to.be.equal('50208107346352812154')
      expect(userSop.plentyPerRoot).to.be.equal('5018803213349941239')
    })

    it('tracks user2 plenty', async function () {
      expect(await this.siloGetters.connect(user).balanceOfPlenty(user2Address)).to.be.equal('50208107346352812154')
    })

    it('tracks user2 plenty after update', async function () {
      await this.silo.mow(user2Address, this.beanMetapool.address);
      // await this.silo.mow(user2Address, this.bean.address); //with this one uncommented it's 10002000000000000000000000
      const userSop = await this.siloGetters.balanceOfSop(user2Address);
      expect(userSop.lastRain).to.be.equal(5)
      expect(userSop.lastSop).to.be.equal(5)
      expect(userSop.roots).to.be.equal('10004000000000000000000000')
      expect(userSop.plenty).to.be.equal('50208107346352812154')
      expect(userSop.plentyPerRoot).to.be.equal('5018803213349941239')
    })

    it('claims user plenty', async function () {
      await this.silo.mow(user2Address, this.beanMetapool.address);
      await this.silo.connect(user2).claimPlenty();
      expect(await this.siloGetters.balanceOfPlenty(user2Address)).to.be.equal('0')
      expect(await this.threeCurve.balanceOf(user2Address)).to.be.equal('50208107346352812154')
    })
  })

  describe('multiple sop', async function () {
    beforeEach(async function () {
      await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('50'))
      await this.season.rainSunrise();
      await this.silo.mow(user2Address, this.bean.address);
      await this.season.rainSunrise();
      await this.season.droughtSunrise();
      await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('50'))
      await this.season.rainSunrises(2);
    })

    it('sops p > 1', async function () {
      const season = await this.seasonGetters.time();
      const balances = await this.beanMetapool.get_balances()
      const scaledBalance1 = balances[1].div(ethers.utils.parseEther('0.000001'));
      expect(balances[0]).to.be.within(scaledBalance1.sub(1),scaledBalance1.add(1))
      expect(season.lastSop).to.be.equal(season.rainStart);
      expect(season.lastSopSeason).to.be.equal(await this.seasonGetters.season());
      expect(await this.threeCurve.balanceOf(this.silo.address)).to.be.equal('200797438285419950779')
    })

    it('tracks user plenty before update', async function () {
      expect(await this.siloGetters.connect(user).balanceOfPlenty(userAddress)).to.be.equal('100393702589806791251')
    })

    it('tracks user plenty after update', async function () {
      await this.silo.mow(userAddress, this.beanMetapool.address);
      const userSop = await this.siloGetters.balanceOfSop(userAddress);
      expect(userSop.lastRain).to.be.equal(8)
      expect(userSop.lastSop).to.be.equal(8)
      expect(userSop.roots).to.be.equal('10004000000000000000000000')
      expect(userSop.plenty).to.be.equal('100393702589806791251')
      expect(userSop.plentyPerRoot).to.be.equal('10035356116534065499')
    })

    it('tracks user2 plenty', async function () {
      expect(await this.siloGetters.connect(user).balanceOfPlenty(user2Address)).to.be.equal('100403735695613159499')
    })

    it('tracks user2 plenty after update', async function () {
      await this.silo.mow(user2Address, this.beanMetapool.address);
      await this.silo.mow(user2Address, this.bean.address);
      const userSop = await this.siloGetters.balanceOfSop(user2Address);
      expect(userSop.lastRain).to.be.equal(8)
      expect(userSop.lastSop).to.be.equal(8)
      expect(userSop.roots).to.be.equal('10006000000000000000000000')
      expect(userSop.plenty).to.be.equal('100403735695613159499')
      expect(userSop.plentyPerRoot).to.be.equal('10035356116534065499')
    })
  })
})