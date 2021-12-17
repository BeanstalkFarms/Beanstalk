const hre = require("hardhat")
const { BN, expectRevert } = require("@openzeppelin/test-helpers")
const { deploy } = require('../scripts/deploy.js')
const { upgradeWithNewFacets } = require('../scripts/diamond.js')
const { expect } = require('chai')
const { printTestCrates, printCrates, print } = require('./utils/print.js')
const { parseJson, incrementTime } = require('./utils/helpers.js')
const { MIN_PLENTY_BASE, ZERO_ADDRESS, MAX_UINT256 } = require('./utils/constants.js')

// Set the test data
const [columns, tests] = parseJson('./coverage_data/siloGovernance.json')
var startTest = 0
var numberTests = tests.length-startTest
// numberTests = 1

const users = ['userAddress', 'user2Address', 'ownerAddress', 'otherAddress']

async function propose(user,g,bip,p=0) {
  return await g.connect(user).propose(bip.diamondCut, bip.initFacetAddress, bip.functionCall, p)
}

let user,user2,user3,owner;
let userAddress, ownerAddress, user2Address, user3Address;
let seasonTimestamp;

describe('Stalk ERC20', function () {

  before(async function () {
    [owner,user,user2,user3] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    user3Address = user3.address;
    
    // Print out all Functions in Contract 
    const contracts = await deploy("Test", true, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address);
    this.governance = await ethers.getContractAt('MockGovernanceFacet', this.diamond.address);
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.diamondLoupeFacet = await ethers.getContractAt('DiamondLoupeFacet', this.diamond.address)
    console.log(await this.governance.activeBips());

    this.empty = {
      diamondCut: [],
      initFacetAddress: ZERO_ADDRESS,
      functionCall: '0x'
    }

    this.bip = await upgradeWithNewFacets ({
      diamondAddress: this.diamond.address,
      facetNames: ['MockUpgradeFacet'],
      selectorsToRemove: [],
      initFacetName: 'MockUpgradeInitDiamond',
      initArgs: [],
      object: true,
      verbose: false,
    })

    await this.bean.mint(userAddress, '1000000');
    await this.bean.mint(user2Address, '1000000');
    await this.bean.mint(user3Address, '1000000');
  });

  beforeEach(async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(user3Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState();
    await this.season.siloSunrise(0);
    await this.silo.depositSiloAssetsE(userAddress, '500', '1000000');
    await this.silo.depositSiloAssetsE(user2Address, '500', '1000000');
    await this.silo.depositSiloAssetsE(ownerAddress, '500', '1000000');

  });

  describe('Decimals getter', function () {
    it('should return 10 decimals', async function () {
      const decimalNumber = await this.silo.decimals();
      expect(decimalNumber.toString()).to.be.equal('10');
    });

  })

  describe('Incrementing Stalk Multiple Accounts', function () {

    it('Increments Stalk Correctly, Single Increment', async function () {
      const userStalkErc20 = await this.silo.balanceOf(userAddress);
      const user2StalkErc20 = await this.silo.balanceOf(user2Address);
      const ownerStalkErc20 = await this.silo.balanceOf(ownerAddress);

      console.log(`Stalk Tokens: ${await this.silo.balanceOf(userAddress)}`)
      const totalStalkSupplyErc20 = await this.silo.totalSupply();
      console.log(`Total Stalk Supply: ${await this.silo.totalSupply()}`)
      expect(userStalkErc20.add(user2StalkErc20).add(ownerStalkErc20)).be.equal(totalStalkSupplyErc20);
    });

    it('Increments Stalk Correctly, Multiple Accounts', async function () {
      await this.silo.incrementBalanceOfStalkE(user2Address, '5000');
      const userStalkErc20 = await this.silo.balanceOf(userAddress);
      const user2StalkErc20 = await this.silo.balanceOf(user2Address);
      const ownerStalkErc20 = await this.silo.balanceOf(ownerAddress);
      const totalStalkSupplyErc20 = await this.silo.totalSupply();
      expect(totalStalkSupplyErc20.sub(ownerStalkErc20)).to.be.equal(userStalkErc20.add(user2StalkErc20));
    });

    it('Increments Stalk Correctly, Multiple Increments', async function () {
      const initialUser2StalkErc20 = await this.silo.balanceOf(user2Address);
      await this.silo.incrementBalanceOfStalkE(user2Address, '1000')
      const postUser2StalkErc20 = await this.silo.balanceOf(user2Address);
      expect(postUser2StalkErc20).to.be.equal(initialUser2StalkErc20.add('1000'));
    });

  });

  describe('Withdrawing/Decrementing Stalk', function () {
    beforeEach(async function () {
      await this.silo.incrementBalanceOfStalkE(userAddress, '5000')
    });

    it('Withdrawing/Decrementing Stalk Correctly, Single Decrement', async function () {
      const initialUserStalkErc20 = await this.silo.balanceOf(userAddress);
      await this.silo.withdrawSiloAssetsE(userAddress, '1', '2000')
      const postUserStalkErc20 = await this.silo.balanceOf(userAddress);
      expect(postUserStalkErc20).to.be.equal(initialUserStalkErc20.sub('2000'))
    });

    it('Withdrawing/Decrementing Stalk Correctly, Multiple Decrements', async function () {
      const initialUserStalkErc20 = await this.silo.balanceOf(userAddress);
      await this.silo.withdrawSiloAssetsE(userAddress, '1', '2000')
      await this.silo.withdrawSiloAssetsE(userAddress, '1', '3000')
      const postUserStalkErc20 = await this.silo.balanceOf(userAddress);
      expect(postUserStalkErc20).to.be.equal(initialUserStalkErc20.sub('5000'))
    });

    it('Withdrawing/Decrementing Stalk Correctly, Multiple Accounts', async function () {
      await this.silo.incrementBalanceOfStalkE(user2Address, '2000');
      await this.silo.withdrawSiloAssetsE(user2Address, '1', '1000');
      const userStalkErc20 = await this.silo.balanceOf(userAddress);
      const user2StalkErc20 = await this.silo.balanceOf(user2Address);
      const totalStalkSupplyErc20 = await this.silo.totalSupply();
      expect(totalStalkSupplyErc20).to.be.equal(userStalkErc20.add(user2StalkErc20));
    });

  });

  describe('Transfering Stalk', function () {
    it('Transfers Stalk Correctly, Single transfer', async function () {
      const initialUser2StalkErc20 = await this.silo.balanceOf(user2Address);
      await this.silo.connect(user).transfer(user2Address, '1000')
      const postUser2StalkErc20 = await this.silo.balanceOf(user2Address);
      expect(postUser2StalkErc20).to.be.equal(initialUser2StalkErc20.add('1000'));
    });

    it('Transfers Stalk Correctly, Multiple transfers', async function () {
      const initialUser2StalkErc20 = await this.silo.balanceOf(user2Address);
      const initialUserStalkErc20 = await this.silo.balanceOf(userAddress);
      await this.silo.connect(user).transfer(user2Address, '1000')
      await this.silo.connect(user).transfer(user2Address, '3000')
      await this.silo.connect(user2).transfer(userAddress, '1000')
      const postUser2StalkErc20 = await this.silo.balanceOf(user2Address);
      const postUserStalkErc20 = await this.silo.balanceOf(userAddress);
      expect(postUser2StalkErc20).to.be.equal(initialUser2StalkErc20.add('3000'));
      expect(postUserStalkErc20).to.be.equal(initialUserStalkErc20.sub('3000'));
    });

  });

  describe('Transfering with transferFrom Stalk', function () {
    beforeEach(async function() {
      await this.silo.increaseAllowance(ownerAddress, '10000')
      await this.silo.increaseAllowance(userAddress, '10000')
      await this.silo.increaseAllowance(user2Address, '10000')
    })

    it('transferFrom Stalk Correctly, Single transfer', async function () {
      const initialUser2StalkErc20 = await this.silo.balanceOf(user2Address);
      console.log(`Stalk Tokens: ${await this.silo.balanceOf(userAddress)}`)
      await this.silo.connect(owner).transferFrom(userAddress, user2Address, '1000')
      const postUser2StalkErc20 = await this.silo.balanceOf(user2Address);
      expect(postUser2StalkErc20).to.be.equal(initialUser2StalkErc20.add('2000'));
    });

    it('transferFrom Stalk Correctly, Multiple transfers', async function () {
      const initialUser2StalkErc20 = await this.silo.balanceOf(user2Address);
      const initialUserStalkErc20 = await this.silo.balanceOf(userAddress);
      const initialOwnerStalkErc20 = await this.silo.balanceOf(ownerAddress);
      await this.silo.incrementBalanceOfStalkE(userAddress, '2000');
      await this.silo.connect(owner).transferFrom(userAddress, user2Address, '500')
      await this.silo.connect(owner).transferFrom(userAddress, ownerAddress, '1000')
      const postUser2StalkErc20 = await this.silo.balanceOf(user2Address);
      const postUserStalkErc20 = await this.silo.balanceOf(userAddress);
      const postOwnerStalkErc20 = await this.silo.balanceOf(ownerAddress);
      expect(postUser2StalkErc20).to.be.equal(initialUser2StalkErc20.add('500'));
      expect(postUserStalkErc20).to.be.equal(initialUserStalkErc20.sub('500'));
      expect(postOwnerStalkErc20).to.be.equal(initialOwnerStalkErc20.add('2000'));
    });

  });
});