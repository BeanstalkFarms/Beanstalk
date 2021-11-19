const hre = require("hardhat")
const { deploy } = require('../scripts/deploy.js')
const { upgradeWithNewFacets } = require('../scripts/diamond.js')
const { expect } = require('chai') 

const FUNDRAISING_BUDGET = '0x74d01F9dc15E92A9235DaA8f2c6F8bfAd9904858'
let user,user2,owner
let userAddress, ownerAddress, user2Address

describe('BIP3', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    const account = new ethers.Wallet(process.env.PRIVATE_KEY, ethers.provider)

    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
  });

  beforeEach (async function () {
    await this.season.resetAccount(FUNDRAISING_BUDGET)
    await this.season.resetState()
    await this.season.siloSunrise(0)
    await this.bean.burnAll(FUNDRAISING_BUDGET)
  });

  describe(">240k Soil", async function () {
    beforeEach(async function () {
        await this.field.incrementTotalSoilEE('300000000000')
        await upgradeWithNewFacets({
            diamondAddress: this.diamond.address,
            initFacetName: 'InitBip3',
            bip: false,
            verbose: false,
            account: owner
        })
    });
    it('inits bip 3', async function () {
        expect(await this.bean.balanceOf(FUNDRAISING_BUDGET)).to.equal('60000000000')
        expect(await this.field.plot(FUNDRAISING_BUDGET, 0)).to.equal('240000000000')
    });
  })

  describe("= 240k Soil", async function () {
    beforeEach(async function () {
        await this.field.incrementTotalSoilEE('240000000000')
        await upgradeWithNewFacets({
            diamondAddress: this.diamond.address,
            initFacetName: 'InitBip3',
            bip: false,
            verbose: false,
            account: owner
        });
    });
    it('inits bip 3', async function () {
        expect(await this.bean.balanceOf(FUNDRAISING_BUDGET)).to.equal('60000000000')
        expect(await this.field.plot(FUNDRAISING_BUDGET, 0)).to.equal('240000000000')
    });
  })

  describe("<240k Soil", async function () {
    beforeEach(async function () {
        await this.field.incrementTotalSoilEE('50000000000')
        await upgradeWithNewFacets({
            diamondAddress: this.diamond.address,
            initFacetName: 'InitBip3',
            bip: false,
            verbose: false,
            account: owner
        });
    });

    it('inits bip 3', async function () {
        expect(await this.bean.balanceOf(FUNDRAISING_BUDGET)).to.equal('250000000000')
        expect(await this.field.plot(FUNDRAISING_BUDGET, 0)).to.equal('50000000000')
    });
  })

  describe("<240k Soil, Existing Sow", async function () {
    beforeEach(async function () {
        await this.field.incrementTotalPodsE('1000000')
        await this.field.incrementTotalSoilEE('50000000000')
        await upgradeWithNewFacets({
            diamondAddress: this.diamond.address,
            initFacetName: 'InitBip3',
            bip: false,
            verbose: false,
            account: owner
        })
    });

    it('inits bip 3', async function () {
        expect(await this.bean.balanceOf(FUNDRAISING_BUDGET)).to.equal('250000000000')
        expect(await this.field.plot(FUNDRAISING_BUDGET, '1000000')).to.equal('50000000000')
    });
  })

  describe("0 Soil", async function () {
    beforeEach(async function () {
        await upgradeWithNewFacets({
            diamondAddress: this.diamond.address,
            initFacetName: 'InitBip3',
            bip: false,
            verbose: false,
            account: owner
        })
    });

    it('inits bip 3', async function () {
        expect(await this.bean.balanceOf(FUNDRAISING_BUDGET)).to.equal('300000000000')
    });
  })
});