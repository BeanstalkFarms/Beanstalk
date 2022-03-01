const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
describe('Uniswap', function () {
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
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.uniswap = await ethers.getContractAt('MockUniswapFacet', this.diamond.address);
    this.weth = await ethers.getContractAt('MockWETH', contracts.weth);

    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.weth.mint(userAddress, '10000');
    await this.weth.mint(user2Address, '10000');
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

  describe('Add Liquidity', function () {
   it('reverts', async function () {
   });
   it('add liquidity to the pair', async function () {
	await this.uniswap.addLiquidityOnUniswap('1000', '1', '980', '1');
   });
   it('add eth liquidity to the pair', async function () {
	await this.uniswap.addLiquidityETHOnUniswap('1000', '980', '1');
   });
   it('properly updates the user\'s LP tokens', async function () {
   });
  });
  describe('Remove Liquidity', function () {
   it('remove liquidity from the pair', async function () {
   });
   it('remove eth liquidity from the pair', async function () {
   });
   it('properly updates the user\'s LP tokens', async function () {
   });
  });
  describe('Swap', async function () {
   it('properly performs swapExactTokensForTokens', async function () {
   });
   it('properly performs swapExactETHForTokens', async function () {
   });
  });
});
