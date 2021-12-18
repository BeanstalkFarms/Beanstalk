// The 'address(new seed())' call in /contracts/farm/init/InitSeed.sol will have to be uncommented for release
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;
describe('Seed', function () {
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
    this.seed = await ethers.getContractAt('MockToken', contracts.seed);

    await this.pair.simulateTrade('2000', '2');
    await this.pair.faucet(userAddress, '1');
    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.pair.connect(user).approve(this.silo.address, '100000000000');
    await this.pair.connect(user2).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000');
    await this.seed.connect(user).approve(this.silo.address, '10000000000');
    await this.seed.connect(user2).approve(this.silo.address, '1000000000');
  });

  beforeEach (async function () {
    await this.pair.burnAllLP(this.silo.address);
    await this.pair.burnAllLP(userAddress);
    await this.pair.burnAllLP(user2Address);
    await this.pair.burnAllLP(ownerAddress);
  });

    describe('ERC20 Traits', async function () {
      it('properly mints the user seeds and beans', async function () {
	await this.seed.mint(userAddress, '1000');
	await this.seed.mint(user2Address, '3000');
	await this.bean.mint(userAddress, '5000');
	await this.bean.mint(user2Address, '8000');
	expect(await this.seed.balanceOf(userAddress)).to.eq('1000');
	expect(await this.seed.balanceOf(user2Address)).to.eq('3000');
	expect(await this.bean.balanceOf(userAddress)).to.eq('1000005000');
	expect(await this.bean.balanceOf(user2Address)).to.eq('1000008000');
      });
      it('properly burns seeds and beans', async function () {
	await this.seed.connect(user).burn('500');
	await this.seed.connect(user2).burn('1000');
	await this.bean.connect(user).burn('5000');
	await this.bean.connect(user2).burn('8000');
	expect(await this.seed.balanceOf(userAddress)).to.eq('500');
        expect(await this.seed.balanceOf(user2Address)).to.eq('2000');
	expect(await this.bean.balanceOf(userAddress)).to.eq('1000000000');
	expect(await this.bean.balanceOf(user2Address)).to.eq('1000000000');
      });
      it('properly transfers seeds to other users', async function () {
	await this.seed.connect(user).transfer(user2Address, '500');
	await this.bean.connect(user).transfer(user2Address, '5000');
	expect(await this.seed.balanceOf(userAddress)).to.eq('0');
	expect(await this.seed.balanceOf(user2Address)).to.eq('2500');
	expect(await this.bean.balanceOf(userAddress)).to.eq('999995000');
	expect(await this.bean.balanceOf(user2Address)).to.eq('1000005000');
      });
      it('properly transfers from another account', async function () {
	await this.seed.transferFrom(user2Address, this.silo.address, '1000');
	expect(await this.seed.balanceOf(this.silo.address)).to.eq('1000');
	expect(await this.seed.balanceOf(user2Address)).to.eq('1500');
     });
   });
   describe('Enumeration', async function() {
      it('properly returns the correct balance of all fungible seeds', async function () {
	expect(await this.seed.totalSupply()).to.eq('2500');
      });
      it('properly returns the balance of all non-fungible seeds', async function () {
	await this.silo.connect(user).depositBeans('1000');
	await this.silo.connect(user2).depositBeans('1000');
	expect(await this.silo.totalSeeds()).to.eq('4000');
      });
   });
   describe('Transition from Silo to ERC20', async function () {
    describe('Seed Conversion', async function () {
      it('properly converts non-fungible seeds to the ERC-20 token', async function () {
	await this.silo.convertSeeds(userAddress);
	await this.silo.convertSeeds(user2Address);
	expect(await this.seed.balanceOf(userAddress)).to.eq('2000');
	expect(await this.seed.balanceOf(user2Address)).to.eq('4500');
	expect(await this.silo.totalSeeds()).to.eq('0');
      });
      it('does not create or destroy existing balance of both fungible and non-fungible seeds', async function () {
	expect(await this.seed.totalSupply()).to.eq('6500');
	expect(await this.silo.totalSeeds()).to.eq('0');
      });
    });
  });
});
