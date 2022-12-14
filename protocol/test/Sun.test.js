const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { to6, toStalk } = require('./utils/helpers.js');
const { USDC, UNRIPE_LP } = require('./utils/constants.js');

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

describe('Sun', function () {
  before(async function () {
    [owner, user, user2] = await ethers.getSigners()
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.usdc = await ethers.getContractAt('MockToken', USDC);
    await this.usdc.mint(owner.address, to6('10000'))
    await this.usdc.connect(owner).approve(this.diamond.address, to6('10000'))
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeLP.mint(owner.address, to6('10000'))

    await this.season.siloSunrise(0)
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  it("delta B < 1", async function () {
    this.result = await this.season.sunSunrise('-100', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '100');
  })

  it("delta B == 1", async function () {
    this.result = await this.season.sunSunrise('0', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '0');
  })

  it("delta B > 1, low pod rate", async function () {
    await this.field.incrementTotalPodsE('100');
    this.result = await this.season.sunSunrise('300', 0);
    expect(await this.field.totalSoil()).to.be.equal('148')
  })

  it("delta B > 1, medium pod rate", async function () {
    await this.field.incrementTotalPodsE('100');
    this.result = await this.season.sunSunrise('300', 8);
    expect(await this.field.totalSoil()).to.be.equal('99')
  })

  it("delta B > 1, high pod rate", async function () {
    await this.field.incrementTotalPodsE('100');
    this.result = await this.season.sunSunrise('300', 25);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '49');
  })

  it("only silo", async function () {
    this.result = await this.season.sunSunrise('100', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '0');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '0', '100', '0');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("some harvestable", async function () {
    await this.field.incrementTotalPodsE('150');
    this.result = await this.season.sunSunrise('200', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '99');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '100', '100', '0');

    expect(await this.field.totalHarvestable()).to.be.equal('100');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("all harvestable", async function () {
    await this.field.incrementTotalPodsE('50');
    this.result = await this.season.sunSunrise('150', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '49');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '50', '100', '0');

    expect(await this.field.totalHarvestable()).to.be.equal('50');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  //

  it("all harvestable and all fertilizable", async function () {
    await this.field.incrementTotalPodsE(to6('50'));
    await this.fertilizer.connect(owner).addFertilizerOwner('6274', '20', '0')
    this.result = await this.season.sunSunrise(to6('200'), 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '49504950');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, to6('50'), to6('100'), to6('50'));

    expect(await this.fertilizer.isFertilizing()).to.be.equal(false);
    expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal(to6('50'));
    expect(await this.fertilizer.getActiveFertilizer()).to.be.equal(to6('0'));
    expect(await this.fertilizer.getFirst()).to.be.equal(0)
    expect(await this.fertilizer.getLast()).to.be.equal(0)
    expect(await this.fertilizer.beansPerFertilizer()).to.be.equal(to6('2.5'))

    expect(await this.field.totalHarvestable()).to.be.equal(to6('50'));

    expect(await this.silo.totalStalk()).to.be.equal(toStalk('100'));
    expect(await this.silo.totalEarnedBeans()).to.be.equal(to6('100'));
  })

  it("all harvestable, some fertilizable", async function () {
    await this.field.incrementTotalPodsE('50');
    await this.fertilizer.connect(owner).addFertilizerOwner('0', '1', '0')
    this.result = await this.season.sunSunrise('200', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '49');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '50', '84', '66');

    expect(await this.fertilizer.isFertilizing()).to.be.equal(true);
    expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal('66');
    expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('1');
    expect(await this.fertilizer.getFirst()).to.be.equal(to6('6'))
    expect(await this.fertilizer.getLast()).to.be.equal(to6('6'))
    expect(await this.fertilizer.beansPerFertilizer()).to.be.equal(66)

    expect(await this.field.totalHarvestable()).to.be.equal('50');

    expect(await this.silo.totalStalk()).to.be.equal('840000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('84');
  })

  it("some harvestable, some fertilizable", async function () {
    await this.field.incrementTotalPodsE('100');
    await this.fertilizer.connect(owner).addFertilizerOwner('0', '1', '0')
    this.result = await this.season.sunSunrise('150', 8);
    await expect(this.result).to.emit(this.season, 'Soil').withArgs(3, '49');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs(3, '50', '50', '50');

    expect(await this.fertilizer.isFertilizing()).to.be.equal(true);
    expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal('50');
    expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('1');
    expect(await this.fertilizer.getFirst()).to.be.equal(to6('6'))
    expect(await this.fertilizer.getLast()).to.be.equal(to6('6'))
    expect(await this.fertilizer.beansPerFertilizer()).to.be.equal(50)

    expect(await this.field.totalHarvestable()).to.be.equal('50');

    expect(await this.silo.totalStalk()).to.be.equal('500000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('50');
  })

  it("1 all and 1 some fertilizable", async function () {
    await this.field.incrementTotalPodsE(to6('250'));
    await this.fertilizer.connect(owner).addFertilizerOwner('0', '40', '0')
    this.result = await this.season.sunSunrise(to6('120'), 8);
    await this.fertilizer.connect(owner).addFertilizerOwner('6374', '40', '0')
    this.result = await this.season.sunSunrise(to6('480'), 8);

    expect(await this.fertilizer.isFertilizing()).to.be.equal(true);
    expect(await this.fertilizer.totalFertilizedBeans()).to.be.equal(to6('200'));
    expect(await this.fertilizer.getActiveFertilizer()).to.be.equal('40');
    expect(await this.fertilizer.getFirst()).to.be.equal(to6('6'))
    expect(await this.fertilizer.getLast()).to.be.equal(to6('6'))
    expect(await this.fertilizer.beansPerFertilizer()).to.be.equal(to6('3'))

    expect(await this.field.totalHarvestable()).to.be.equal(to6('200'));

    expect(await this.silo.totalStalk()).to.be.equal(toStalk('200'));
    expect(await this.silo.totalEarnedBeans()).to.be.equal(to6('200'));
  })

  // describe("Earned Bean Distrubution", function() {
  //   it("Propertly distrubutes")
  // })
})