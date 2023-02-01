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
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('Bean', BEAN)
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE)
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL)
    this.beanMetapool = await ethers.getContractAt('IMockCurvePool', BEAN_3_CURVE)

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
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  describe("Rain", async function () {
    it("Not raining", async function () {
      const season = await this.season.time()
      expect(season.raining).to.be.equal(false)
    })

    it("Raining", async function () {
      await this.field.incrementTotalPodsE(to18('100'))
      await this.season.rainSunrise()
      await this.silo.mow(userAddress, this.beanMetapool);
      const rain = await this.season.rain()
      const season = await this.season.time()
      expect(season.rainStart).to.be.equal(season.current)
      expect(season.raining).to.be.equal(true)
      expect(rain.pods).to.be.equal(await this.field.totalPods())
      expect(rain.roots).to.be.equal('20000000000000000000000000')
      const userRain = await this.silo.balanceOfSop(userAddress);
      expect(userRain.lastRain).to.be.equal(season.rainStart);
      expect(userRain.roots).to.be.equal('10000000000000000000000000');
    })

    it("Stops raining", async function () {
      await this.field.incrementTotalPodsE(to18('100'))
      await this.season.rainSunrise()
      await this.silo.mow(userAddress, this.beanMetapool);
      await this.season.droughtSunrise()
      await this.silo.mow(userAddress, this.beanMetapool);
      const season = await this.season.time()
      expect(season.rainStart).to.be.equal(season.current - 1)
      const userRain = await this.silo.balanceOfSop(userAddress);
      expect(userRain.lastRain).to.be.equal(0);
    })
  })

  describe('Sop when P <= 1', async function () {
    it('sops p = 1', async function () {
      await this.season.rainSunrises(25);
      const season = await this.season.time();
      const rain = await this.season.rain()
      expect(season.lastSop).to.be.equal(0);
      expect(season.lastSopSeason).to.be.equal(0);
    })

    it('sops p < 1', async function () {
      await this.beanMetapool.connect(user).add_liquidity([to6('100'), to18('0')], to18('50'))
      await this.season.rainSunrises(25);
      const season = await this.season.time();
      const rain = await this.season.rain()
      expect(season.lastSop).to.be.equal(0);
      expect(season.lastSopSeason).to.be.equal(0);
    })
  })

  describe('1 sop', async function () {
    beforeEach(async function () {
      await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('50'))
      await this.season.rainSunrise();
      await this.silo.mow(user2Address);
      await this.season.rainSunrises(24);
    })

    it('sops p > 1', async function () {
      const season = await this.season.time();
      const balances = await this.beanMetapool.get_balances()
      const scaledBalance1 = balances[1].div(ethers.utils.parseEther('0.000001'));
      expect(balances[0]).to.be.within(scaledBalance1.sub(1),scaledBalance1.add(1))
      expect(season.lastSop).to.be.equal(season.rainStart);
      expect(season.lastSopSeason).to.be.equal(await this.season.season());
      expect(await this.threeCurve.balanceOf(this.silo.address)).to.be.equal('100416214692705624318')
    })

    it('tracks user plenty before update', async function () {
      expect(await this.silo.connect(user).balanceOfPlenty(userAddress)).to.be.equal('50208107346352812150')
    })

    it('tracks user plenty after update', async function () {
      await this.silo.mow(userAddress, this.beanMetapool);
      const userSop = await this.silo.balanceOfSop(userAddress);
      expect(userSop.lastRain).to.be.equal(3)
      expect(userSop.lastSop).to.be.equal(3)
      expect(userSop.roots).to.be.equal('10000000000000000000000000')
      expect(userSop.plenty).to.be.equal('50208107346352812150')
      expect(userSop.plentyPerRoot).to.be.equal('5020810734635281215')
    })

    it('tracks user2 plenty', async function () {
      expect(await this.silo.connect(user).balanceOfPlenty(user2Address)).to.be.equal('50208107346352812150')
    })

    it('tracks user2 plenty after update', async function () {
      await this.silo.mow(user2Address);
      const userSop = await this.silo.balanceOfSop(user2Address);
      expect(userSop.lastRain).to.be.equal(3)
      expect(userSop.lastSop).to.be.equal(3)
      expect(userSop.roots).to.be.equal('10000000000000000000000000')
      expect(userSop.plenty).to.be.equal('50208107346352812150')
      expect(userSop.plentyPerRoot).to.be.equal('5020810734635281215')
    })

    it('claims user plenty', async function () {
      await this.silo.mow(user2Address);
      await this.silo.connect(user2).claimPlenty();
      expect(await this.silo.balanceOfPlenty(user2Address)).to.be.equal('0')
      expect(await this.threeCurve.balanceOf(user2Address)).to.be.equal('50208107346352812150')
    })
  })

  describe('multiple sop', async function () {
    beforeEach(async function () {
      await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('50'))
      await this.season.rainSunrise();
      await this.silo.mow(user2Address);
      await this.season.rainSunrises(24);
      await this.season.droughtSunrise();
      await this.beanMetapool.connect(user).add_liquidity([to6('0'), to18('200')], to18('50'))
      await this.season.rainSunrises(25);
    })

    it('sops p > 1', async function () {
      const season = await this.season.time();
      const balances = await this.beanMetapool.get_balances()
      const scaledBalance1 = balances[1].div(ethers.utils.parseEther('0.000001'));
      expect(balances[0]).to.be.within(scaledBalance1.sub(1),scaledBalance1.add(1))
      expect(season.lastSop).to.be.equal(season.rainStart);
      expect(season.lastSopSeason).to.be.equal(await this.season.season());
      expect(await this.threeCurve.balanceOf(this.silo.address)).to.be.equal('200797438285419950779')
    })

    it('tracks user plenty before update', async function () {
      expect(await this.silo.connect(user).balanceOfPlenty(userAddress)).to.be.equal('100393700583386272030')
    })

    it('tracks user plenty after update', async function () {
      await this.silo.mow(userAddress, this.beanMetapool);
      const userSop = await this.silo.balanceOfSop(userAddress);
      expect(userSop.lastRain).to.be.equal(29)
      expect(userSop.lastSop).to.be.equal(29)
      expect(userSop.roots).to.be.equal('10000000000000000000000000')
      expect(userSop.plenty).to.be.equal('100393700583386272030')
      expect(userSop.plentyPerRoot).to.be.equal('10039370058338627203')
    })

    it('tracks user2 plenty', async function () {
      expect(await this.silo.connect(user).balanceOfPlenty(user2Address)).to.be.equal('100403737702033678721')
    })

    it('tracks user2 plenty after update', async function () {
      await this.silo.mow(user2Address);
      const userSop = await this.silo.balanceOfSop(user2Address);
      expect(userSop.lastRain).to.be.equal(29)
      expect(userSop.lastSop).to.be.equal(29)
      expect(userSop.roots).to.be.equal('10002000000000000000000000')
      expect(userSop.plenty).to.be.equal('100403737702033678721')
      expect(userSop.plentyPerRoot).to.be.equal('10039370058338627203')
    })
  })
})