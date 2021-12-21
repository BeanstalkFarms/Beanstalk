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
    await this.seed.connect(user).approve(user2Address, '10000000000');
    await this.seed.connect(user2).approve(userAddress, '1000000000');

  });

  beforeEach (async function () {
    await this.pair.burnAllLP(this.silo.address);
    await this.pair.burnAllLP(userAddress);
    await this.pair.burnAllLP(user2Address);
    await this.pair.burnAllLP(ownerAddress);
  });

    describe('ERC20 Traits', async function () {
      it('properly mints the user seeds', async function () {
	await this.seed.mint(userAddress, '1000');
	await this.seed.mint(user2Address, '3000');
	await this.bean.mint(userAddress, '5000');
	await this.bean.mint(user2Address, '8000');
	expect(await this.seed.balanceOf(userAddress)).to.eq('1000');
	expect(await this.seed.balanceOf(user2Address)).to.eq('3000');
      });
      it('properly transfers seeds to other users', async function () {
	await this.seed.connect(user).transfer(user2Address, '500');
	await this.seed.connect(user2).transfer(userAddress, '1000');
	expect(await this.seed.balanceOf(userAddress)).to.eq('1500');
	expect(await this.seed.balanceOf(user2Address)).to.eq('2500');
      });
      it('properly transfers seeds from another account', async function () {
	await this.seed.connect(user).transferFrom(user2Address, userAddress, '1000');
	expect(await this.seed.balanceOf(userAddress)).to.eq('2500');
	expect(await this.seed.balanceOf(user2Address)).to.eq('1500');
     });
      it('properly burns seeds', async function () {
        await this.seed.connect(user).burn('2500');
        await this.seed.connect(user2).burn('1500');
        expect(await this.seed.balanceOf(userAddress)).to.eq('0');
        expect(await this.seed.balanceOf(user2Address)).to.eq('0');
	expect(await this.seed.totalSupply()).to.eq('0');
      });
   });
   describe('Enumeration', async function() {
      it('properly gives fungible seeds as rewards for newly deposited beans', async function () {
	this.silo.connect(user).depositBeans('100000');
	this.silo.connect(user2).depositBeans('100000');
	expect(await this.seed.totalSupply()).to.eq('400000');
      });
      it('properly returns the correct balance of non-fungible seeds', async function () {
	expect(await this.silo.totalSeeds()).to.eq('0');
      });
   });
   describe('Transition from Silo to ERC20', async function () {
    describe('Seed Conversion', async function () {
      it('properly converts existing non-fungible seeds to the ERC-20 token', async function () {
	await this.silo.connect(user).setNonFungibleSeeds('200000');
	await this.silo.connect(user2).setNonFungibleSeeds('200000');
	await this.silo.convertSeeds(userAddress);
	await this.silo.convertSeeds(user2Address);
	expect(await this.seed.balanceOf(userAddress)).to.eq('400000');
	expect(await this.seed.balanceOf(user2Address)).to.eq('400000');
	await this.seed.connect(user).burn('200000');
	await this.seed.connect(user2).burn('200000');
      });
      it('decrements fungible seeds when withdrawing from the silo', async function () {
	await this.silo.connect(user).depositBeans('100000');
	expect(await this.seed.balanceOf(userAddress)).to.eq('400000');
	await this.silo.connect(user).withdrawBeans([1], ['100000']);
	expect(await this.seed.balanceOf(userAddress)).to.eq('200000');
      });
      it('reverts when users do not have enough seeds to burn upon silo withdrawl', async function () {
	await this.seed.connect(user2).transfer(userAddress, '200000');
	await expect(this.silo.connect(user2).withdrawBeans([1], ['100000'])).to.be.revertedWith('ERC20: burn amount exceeds balance');
	expect(await this.seed.balanceOf(user2Address)).to.eq('0');
      });
    });
  });
   describe('Seed Liquidity Pools', async function () {
    describe('Adding Seeds to LP', async function () {
      it('deposits seeds into the $SEED $ETH LP', async function () {
      
      });
    });
  });
});
