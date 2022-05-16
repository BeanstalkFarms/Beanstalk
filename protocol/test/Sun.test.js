const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")

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
    this.barnRaise = await ethers.getContractAt('MockBarnRaiseFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)

    await this.season.siloSunrise(0)
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  it("delta B < 1", async function () {
    this.result = await this.season.sunSunrise('-100');
    await expect(this.result).to.emit(this.season, 'Soil').withArgs('100');
  })

  it("delta B == 1", async function () {
    this.result = await this.season.sunSunrise('0');
    await expect(this.result).to.emit(this.season, 'Soil').withArgs('0');
  })

  it("only silo", async function () {
    this.result = await this.season.sunSunrise('100');
    await expect(this.result).to.emit(this.season, 'Soil').withArgs('0');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs('0', '100', '0');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("some harvestable", async function () {
    await this.field.incrementTotalPodsE('150');
    this.result = await this.season.sunSunrise('200');
    await expect(this.result).to.emit(this.season, 'Soil').withArgs('99');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs('100', '100', '0');

    expect(await this.field.totalHarvestable()).to.be.equal('100');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("all harvestable", async function () {
    await this.field.incrementTotalPodsE('50');
    this.result = await this.season.sunSunrise('150');
    await expect(this.result).to.emit(this.season, 'Soil').withArgs('49');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs('50', '100', '0');

    expect(await this.field.totalHarvestable()).to.be.equal('50');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("all barnRaising", async function () {
    await this.field.incrementTotalPodsE('50');
    await this.barnRaise.setBarnRaiseE(true, '50');
    this.result = await this.season.sunSunrise('200');
    await expect(this.result).to.emit(this.season, 'Soil').withArgs('49');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs('50', '100', '50');

    expect(await this.barnRaise.barnRaising()).to.be.equal(false);
    expect(await this.barnRaise.totalPaidBR()).to.be.equal('50');

    expect(await this.field.totalHarvestable()).to.be.equal('50');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("all barnRaising", async function () {
    await this.field.incrementTotalPodsE('50');
    await this.barnRaise.setBarnRaiseE(true, '50');
    this.result = await this.season.sunSunrise('200');
    await expect(this.result).to.emit(this.season, 'Soil').withArgs('49');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs('50', '100', '50');

    expect(await this.barnRaise.barnRaising()).to.be.equal(false);
    expect(await this.barnRaise.totalPaidBR()).to.be.equal('50');

    expect(await this.field.totalHarvestable()).to.be.equal('50');

    expect(await this.silo.totalStalk()).to.be.equal('1000000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('100');
  })

  it("some barnRaising", async function () {
    await this.field.incrementTotalPodsE('100');
    await this.barnRaise.setBarnRaiseE(true, '100');
    this.result = await this.season.sunSunrise('150');
    await expect(this.result).to.emit(this.season, 'Soil').withArgs('49');
    await expect(this.result).to.emit(this.season, 'Reward').withArgs('50', '50', '50');

    expect(await this.barnRaise.barnRaising()).to.be.equal(true);
    expect(await this.barnRaise.totalPaidBR()).to.be.equal('50');

    expect(await this.field.totalHarvestable()).to.be.equal('50');

    expect(await this.silo.totalStalk()).to.be.equal('500000');
    expect(await this.silo.totalEarnedBeans()).to.be.equal('50');
  })
})