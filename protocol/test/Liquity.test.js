const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

const minFee = '5000000000000000';

const LUSD_TOKEN = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
const TROVE_MANAGER = "0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2";
const BORROWER_OPERATIONS = "0x24179CD81c9e782A4096035f7eC97fB8B783e007";
const SORTED_TROVES = "0x8FdD3fbFEb32b28fb73555518f8b361bCeA741A6";
const PRICE_FEED = "0x4c517D4e2C851CA76d7eC94B805269Df0f2201De";
const ACTIVE_POOL = "0xDf9Eb223bAFBE5c5271415C75aeCD68C21fE3D7F";
const COLL_SURPLUS_POOL = "0x3D32e8b97Ed5881324241Cf03b2DA5E2EBcE5521";
const DEFAULT_POOL = "0x896a3F03176f05CFbb4f006BfCd8723F2B0D741C";
const STABILITY_POOL = "0x66017D22b0f8556afDd19FC67041899Eb65a21bb";
const GAS_POOL = "0x9555b042F969E561855e5F28cB1230819149A8d9";
const LQTY_STAKING = "0x4f9Fbb3f1E99B56e0Fe2892e623Ed36A76Fc605d";
const LQTY_TOKEN = "0x6DEA81C8171D0bA574754EF6F8b412F2Ed88c54D";

describe('Liquity', function () {
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
    this.weth = await ethers.getContractAt('MockToken', contracts.weth);
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.liquity = await ethers.getContractAt('MockLiquityFacet', this.diamond.address);
    this.borrowerOperations = await ethers.getContractAt("MockBorrowerOperations", BORROWER_OPERATIONS);
    this.lusd = await ethers.getContractAt("MockLUSDToken", LUSD_TOKEN);
    this.troveManager = await ethers.getContractAt("MockTroveManager", TROVE_MANAGER);
    this.sortedTroves = await ethers.getContractAt("MockSortedTroves", SORTED_TROVES);
    this.activePool = await ethers.getContractAt("MockActivePool", ACTIVE_POOL);

    await this.pair.simulateTrade('2000', '2');
    await this.season.siloSunrise(0);
    await this.pair.faucet(userAddress, '1');
    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.pair.connect(user).approve(this.silo.address, '100000000000');
    await this.pair.connect(user2).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000');
    await this.borrowerOperations.setAddresses(TROVE_MANAGER, ACTIVE_POOL, DEFAULT_POOL, STABILITY_POOL, GAS_POOL, COLL_SURPLUS_POOL, PRICE_FEED, SORTED_TROVES, LUSD_TOKEN, LQTY_STAKING);
    await this.troveManager.setAddresses(BORROWER_OPERATIONS, ACTIVE_POOL, DEFAULT_POOL, STABILITY_POOL, GAS_POOL, COLL_SURPLUS_POOL, PRICE_FEED, LUSD_TOKEN, SORTED_TROVES, LQTY_TOKEN, LQTY_STAKING);
    await this.sortedTroves.setParams('1000', TROVE_MANAGER, BORROWER_OPERATIONS);
    await this.lusd.setAddresses(TROVE_MANAGER, STABILITY_POOL, BORROWER_OPERATIONS);
    await this.activePool.setAddresses(BORROWER_OPERATIONS, TROVE_MANAGER, STABILITY_POOL, DEFAULT_POOL);
    await this.lusd.mockMint(this.pair.address, '100000000000000000000000000');
    await this.bean.mint(this.pair.address, '10000000000000000000000');
    await this.weth.mint(this.pair.address, '100000');
  });
  beforeEach(async function () {
  });
   describe('Create Trove', async function () {
    describe('reverts', async function () {
      it('not enough collateral - open trove', async function () {
	await expect(this.liquity.connect(user).collateralizeWithApproxHintE(minFee, '2000000000000000000000', 2, Math.floor(Math.random() * 10), {value: ethers.utils.parseEther('1')}))
		      .to.be.revertedWith("BorrowerOps: An operation that would result in ICR < MCR is not permitted");
	});
      it('not enough collateral - withdraw LUSD', async function () {
	const lusdBefore = await this.lusd.totalSupply();
	await this.liquity.connect(user).collateralizeWithApproxHintE(minFee, '2000000000000000000000', 2, Math.floor(Math.random() * 10), {value: ethers.utils.parseEther('4')});
	expect((await this.lusd.balanceOf(this.silo.address))/1e18).to.eq(2000);
	await expect(this.liquity.connect(user).collateralizeWithApproxHintE(minFee, '2000000000000000000000', 2, Math.floor(Math.random() * 10), {value: ethers.utils.parseEther('0')}))
		      .to.be.revertedWith('BorrowerOps: An operation that would result in ICR < MCR is not permitted');
	const lusdAfter = await this.lusd.totalSupply();
	expect((await this.lusd.balanceOf(this.silo.address))/1e18).to.eq(2000);
	expect((lusdAfter.sub(lusdBefore))/1e18).to.eq(2210);
	expect((await this.liquity.internalBalance(userAddress, this.lusd.address))/1e18).to.eq(2000);
      });
    });
    describe('Borrower Operations', async function () {
     beforeEach(async function () {
    });
      it('opens a trove for a new user', async function () {
	const lusdBefore = await this.lusd.totalSupply();
        await this.liquity.connect(user2).collateralizeWithApproxHintE(minFee, '2000000000000000000000', 2, Math.floor(Math.random() * 10), {value: ethers.utils.parseEther('7')});
	const lusdAfter = await this.lusd.totalSupply();
	expect((await this.lusd.balanceOf(this.silo.address))/1e18).to.eq(4000);
	expect((lusdAfter.sub(lusdBefore))/1e18).to.eq(2210);
	expect((await this.liquity.internalBalance(userAddress, this.lusd.address))/1e18).to.eq(2000);
	expect((await this.liquity.internalBalance(user2Address, this.lusd.address))/1e18).to.eq(2000);
	expect(await this.liquity.associatedTrove(userAddress)).to.not.eq(await this.liquity.associatedTrove(user2Address));
      });
      it('withdraws funds from an existing trove', async function () {
        await this.liquity.connect(user2).collateralizeWithApproxHintE(minFee, '2000000000000000000000', 2, Math.floor(Math.random() * 10), {value: ethers.utils.parseEther('0')});
	expect((await this.lusd.balanceOf(this.silo.address))/1e18).to.eq(6000);
	expect((await this.liquity.internalBalance(user2Address, this.lusd.address))/1e18).to.eq(4000);
	expect((await this.liquity.internalBalance(userAddress, this.lusd.address))/1e18).to.eq(2000);
	expect((await this.lusd.balanceOf(await this.liquity.associatedTrove(user2Address))/1e18)).to.eq(0);
      });
      it('can repay debt', async function () {
	await this.liquity.connect(user).repayDebtE('2000', 2, Math.floor(Math.random() * 10));
	await this.liquity.connect(user2).repayDebtE('4000', 2, Math.floor(Math.random() * 10));	
      });
    });
    describe('Collateral -> Field', async function () {
     beforeEach(async function () {
     });
      it('collateralize and sow', async function () {
	await this.liquity.connect(user).collateralizeAndSowBeans(minFee, '2000000000000000000000', 1000, 980, 2, Math.floor(Math.random() * 10), [false, false, false], {value: ethers.utils.parseEther('10')});
      });
      it('collateralize and fundraise', async function () {
	await this.liquity.connect(user).collateralizeAndFundraise(minFee, '2000000000000000000000', 1000, 980, 0, 2, Math.floor(Math.random() * 10), [false, false, false], {value: ethers.utils.parseEther('10')});
      });
    });
    describe('Collateral -> Silo', async function () {
     beforeEach(async function () {
     });
      it('collateralize and deposit', async function () {
	await this.liquity.connect(user).collateralizeAndDeposit(minFee, '2000000000000000000000', 1000, 980, 2, Math.floor(Math.random() * 10), [false, false, false], {value: ethers.utils.parseEther('10')});
      });
    });
    describe('Collateral -> Beanstalk Functionality', async function () {
     beforeEach(async function () {
     });
      it('collateralize and wrap beans', async function () {
	await this.liquity.connect(user).collateralizeAndUnwrap(minFee, '2000000000000000000000', 1000, 980, 2, Math.floor(Math.random() * 10), [false, false, false], {value: ethers.utils.parseEther('3')});
      });
    });
  });
});
