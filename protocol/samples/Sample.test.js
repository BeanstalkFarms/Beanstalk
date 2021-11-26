const hre = require("hardhat")
const { deploy } = require('../scripts/deploy.js')
const { upgradeWithNewFacets } = require('../scripts/diamond.js')
const { expect } = require('chai') 

const FUNDRAISING_BUDGET = '0x74d01F9dc15E92A9235DaA8f2c6F8bfAd9904858'
let user,user2,owner
let userAddress, ownerAddress, user2Address

describe('BIP3', function () {
// In the before, we deploy a mock Beanstalk and create the facet objects we will use to interact with the contract.
  before(async function () {
    [owner,user,user2] = await ethers.getSigners()
    userAddress = user.address
    user2Address = user2.address
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account
    this.diamond = contracts.beanstalkDiamond
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair)
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair)
    // Create objects for any other faucets here
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)
  });

  describe("Sample", async function () {
    beforeEach(async function () {
        // Put any actions you want to run here.
        // For this example, we will run a mock sunrise function that only advances the silo.
        await this.season.siloSunrise(0)
    });

    it('Checks sample', async function () {
        // Put any checks you want to perform here.
        // For this example, we are checking that the season advances.
        expect(await this.season.season()).to.equal('2')
    });
  })
});