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

describe('Governance', function () {

  before(async function () {
    [owner,user,user2,user3] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    user3Address = user3.address;
    const contracts = await deploy("Test", false, true);
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
    await this.bean.connect(user).approve(this.governance.address, '100000000000');
    await this.bean.connect(owner).approve(this.governance.address, '100000000000');
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
    await this.silo.depositSiloAssetsE(user3Address, '500', '1000000');
    await this.silo.depositSiloAssetsE(ownerAddress, '500', '1000000');
  });

  describe('vote', function () {
    beforeEach(async function () {
      await propose(owner, this.governance, this.bip);
      await propose(owner, this.governance, this.bip);
      await propose(owner, this.governance, this.bip);
      await propose(owner, this.governance, this.bip);
      await propose(owner, this.governance, this.bip);

      await this.governance.connect(user).vote(0);
      await this.governance.connect(user).voteAll([1, 2, 3]);
      await this.governance.connect(user).vote(4);
      await this.governance.connect(user).unvote(1);
      await this.governance.connect(user).unvoteAll([2, 3, 4]);

      await this.governance.connect(user2).vote(0);
      await this.governance.connect(user2).vote(1);
      await this.governance.connect(user2).vote(2);
      await this.governance.connect(user2).unvoteAll([0, 1, 2]);

      await this.governance.connect(user3).vote(0);
      await this.governance.connect(user3).vote(1);
      await this.governance.connect(user3).voteUnvoteAll([0, 1, 2]);
    });

    it('sets vote counter correctly', async function () {
      const ownerRoots = await this.silo.balanceOfRoots(ownerAddress);
      const userRoots = await this.silo.balanceOfRoots(userAddress);
      expect(await this.governance.rootsFor(0)).to.be.equal(ownerRoots.add(userRoots))
      expect(await this.governance.rootsFor(1)).to.be.equal(await this.silo.balanceOfRoots(ownerAddress));
      const user3Roots = await this.silo.balanceOfRoots(user3Address);
      expect(await this.governance.rootsFor(2)).to.be.equal(ownerRoots.add(user3Roots));
      expect(await this.governance.rootsFor(3)).to.be.equal(await this.silo.balanceOfRoots(ownerAddress));
      expect(await this.governance.rootsFor(4)).to.be.equal(await this.silo.balanceOfRoots(ownerAddress));
    });

    it('is active', async function () {
      activeBips = await this.governance.activeBips();
      expect(activeBips[0]).to.eq(0);
      expect(activeBips[1]).to.eq(1);
      expect(activeBips[2]).to.eq(2);
      expect(activeBips[3]).to.eq(3);
    });

    it('records vote in voteList', async function () {
      expect(await this.governance.voted(userAddress, 0)).to.equal(true);
    });

    it('records unvotes in voteList', async function () {
      expect(await this.governance.voted(userAddress, 1)).to.equal(false);
      expect(await this.governance.voted(userAddress, 2)).to.equal(false);
      expect(await this.governance.voted(userAddress, 3)).to.equal(false);
      expect(await this.governance.voted(userAddress, 4)).to.equal(false);

      expect(await this.governance.voted(user2Address, 0)).to.equal(false);
      expect(await this.governance.voted(user2Address, 1)).to.equal(false);

      expect(await this.governance.voted(user3Address, 0)).to.equal(false);
      expect(await this.governance.voted(user3Address, 1)).to.equal(false);
      expect(await this.governance.voted(user3Address, 2)).to.equal(true);
    })

    it('voter cant unvote', async function () {
      expect(await this.silo.locked(userAddress)).to.equal(true);
    });

    it('voter can revote', async function () {
      expect(await this.silo.locked(user2Address)).to.equal(false);
    });

  });
});