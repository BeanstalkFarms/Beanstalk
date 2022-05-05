const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { EXTERNAL, INTERNAL, INTERNAL_EXTERNAL, INTERNAL_TOLERANT } = require('./utils/balances.js')
const { to18, to6, toStalk } = require('./utils/helpers.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

const UNRIPE_BEAN = '0xD5BDcdEc5b2FEFf781eA8727969A95BbfD47C40e';
const UNRIPE_LP = '0x2e4243832DB30787764f152457952C8305f442e4';
const THREE_CURVE = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const BEAN_3_CURVE = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";

const BN_ZERO = ethers.utils.parseEther('0')

let lastTimestamp = 1700000000;
let timestamp;

describe('Silo', function () {
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
    this.bean = await ethers.getContractAt('Bean', contracts.bean)
    this.threeCurve = await ethers.getContractAt('Mock3Curve', THREE_CURVE)
    this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE)

    await this.season.siloSunrise(0)
    await this.bean.connect(user).approve(this.silo.address, '100000000000')
    await this.bean.connect(user2).approve(this.silo.address, '100000000000') 
    await this.bean.connect(user).approve(this.beanMetapool.address, '100000000000')
    await this.bean.mint(userAddress, to6('10000'))
    await this.bean.mint(user2Address, to6('10000'))

    await this.threeCurve.mint(userAddress, to18('100000'))
    await this.threeCurve.set_virtual_price(ethers.utils.parseEther('1'))
    await this.threeCurve.connect(user).set_virtual_price(to18('1'))
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
      const rain = await this.season.rain()
      expect(rain.raining).to.be.equal(false)
    })

    it("Raining", async function () {
      await this.field.incrementTotalPodsE(to18('100'))
      await this.season.rainSunrise()
      const rain = await this.season.rain()
      expect(rain.start).to.be.equal(await this.season.season())
      expect(rain.raining).to.be.equal(true)
      expect(rain.pods).to.be.equal(await this.field.totalPods())
      expect(rain.roots).to.be.equal(await this.silo.totalRoots())
    })

    it("Stops raining", async function () {
      await this.field.incrementTotalPodsE(to18('100'))
      await this.season.rainSunrise()
      await this.season.droughtSunrise()
      const rain = await this.season.rain()
      expect(rain.raining).to.be.equal(false)
    })
  })
})