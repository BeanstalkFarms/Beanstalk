const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
describe('Farm', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond.address);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.farm = await ethers.getContractAt('MockFarmFacet', this.diamond.address)

    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.pair.connect(user).approve(this.silo.address, '100000000000');
    await this.pair.connect(user2).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000'); 
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.pair.burnAllLP(this.silo.address);
    await this.pair.burnAllLP(userAddress);
    await this.pair.burnAllLP(user2Address);
    await this.pair.burnAllLP(ownerAddress);
    await this.season.resetState();
    await this.season.siloSunrise(0);
  });

  describe('Silo Facet', function () {
   it('deposit beans', async function () {	   
   });
   it('withdraw beans', async function () {
   });
   it('interact with existing deposits', async function () {
   });
  });
  describe('Convert Facet', function () {
   it('convert beans to LP', async function () {
   });
   it('convert LP to beans', async function () {
   });
  });
  describe('Field Facet', function () {
   it('sow beans', async function () {
   });
  });
  describe('Uniswap Facet', function () {
   it('swap tokens', async function () {
   });
   it('add liquidity', async function () {
   });
   it('remove liquidity', async function () {
   });
  });
  describe('Fundraiser Facet', function () {
   it('fund an existing fundraiser', async function () {
   });
  });
  describe('Claim Facet', function () {
   it('unwrap beans', async function () {
   });
   it('wrap beans', async function () {
   });
  });
});
