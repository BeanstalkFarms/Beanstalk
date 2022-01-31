const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
describe('Test', function () {
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
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.weth = await ethers.getContractAt('MockToken', contracts.weth)

    await this.pair.set('10000', '40000', '1');
    await this.pegPair.simulateTrade('20000', '20000');
    await this.season.siloSunrise(0);
    await this.pair.faucet(userAddress, '1');
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
    await this.pair.burnTokens(this.bean.address);
    await this.pair.burnTokens(this.weth.address);
    await this.season.resetState();
    await this.season.siloSunrise(0);
  });
 
  it('Does some work', async function () {
    await this.silo.mockLegacySiloDeposit(userAddress, 100, '1000', '10000');
    // await this.silo.mockLegacySiloDeposit(userAddress, 2000, '1000', '10000');
    await this.silo.mockLegacySiloDeposit(userAddress, 50000, '1000', '10000');
    await this.silo.migrateDeposits(userAddress, [100, 50000]);
  });
});
