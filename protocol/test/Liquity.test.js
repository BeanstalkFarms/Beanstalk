const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

const minFee = '5000000000000000';

const TROVE_MANAGER = "0xA39739EF8b0231DbFA0DcdA07d7e29faAbCf4bb2";
const LUSD = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
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
const BEAN_LUSD = "0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D";
const BEAN = '0xDC59ac4FeFa32293A95889Dc396682858d52e5Db';
const ZERO = "0x0000000000000000000000000000000000000000";

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
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.weth = await ethers.getContractAt('MockToken', contracts.weth);
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.liquity = await ethers.getContractAt('MockLiquityFacet', this.diamond.address);
    this.borrowerOperations = await ethers.getContractAt("MockBorrowerOperations", BORROWER_OPERATIONS);
    this.lusd = await ethers.getContractAt("MockLUSDToken", LUSD);
    this.troveManager = await ethers.getContractAt("MockTroveManager", TROVE_MANAGER);
    this.sortedTroves = await ethers.getContractAt("MockSortedTroves", SORTED_TROVES);
    this.activePool = await ethers.getContractAt("MockActivePool", ACTIVE_POOL);
    this.farm = await ethers.getContractAt('MockFarmFacet', this.diamond.address);
    this.uniswap = await ethers.getContractAt('MockUniswapFacet', this.diamond.address);
    this.fundraiser = await ethers.getContractAt("MockFundraiserFacet", this.diamond.address);
    this.field = await ethers.getContractAt("MockFieldFacet", this.diamond.address);
    this.beanLusd = await ethers.getContractAt("MockCurvePool", BEAN_LUSD);
    this.curve = await ethers.getContractAt("MockCurveFacet", this.diamond.address);

    await this.season.siloSunrise(0);
    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, ethers.utils.parseUnits('1', 50));
    await this.lusd.mintE(user2Address, ethers.utils.parseUnits('1', 50));
    await this.bean.connect(user).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.bean.connect(user2).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.lusd.connect(user).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.lusd.connect(user2).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.borrowerOperations.setAddresses(TROVE_MANAGER, ACTIVE_POOL, DEFAULT_POOL, STABILITY_POOL, GAS_POOL, COLL_SURPLUS_POOL, PRICE_FEED, SORTED_TROVES, LUSD, LQTY_STAKING);
    await this.troveManager.setAddresses(BORROWER_OPERATIONS, ACTIVE_POOL, DEFAULT_POOL, STABILITY_POOL, GAS_POOL, COLL_SURPLUS_POOL, PRICE_FEED, LUSD, SORTED_TROVES, LQTY_TOKEN, LQTY_STAKING);
    await this.sortedTroves.setParams('1000', TROVE_MANAGER, BORROWER_OPERATIONS);
    await this.lusd.setAddresses(TROVE_MANAGER, STABILITY_POOL, BORROWER_OPERATIONS);
    await this.activePool.setAddresses(BORROWER_OPERATIONS, TROVE_MANAGER, STABILITY_POOL, DEFAULT_POOL);

    await this.beanLusd.initialize("Bean-LUSD", "BEAN:LUSD", [BEAN, LUSD, ZERO, ZERO], [ethers.utils.parseUnits('1', 30), ethers.utils.parseEther('1'), 0, 0], '100', '5000000000');
    await this.curve.connect(user2).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_LUSD, false, false);
  });
  beforeEach(async function () {
    await this.season.siloSunrise(0);
  });
  describe('Sanity Checks', async function () {
    it('reverts when not supplied collateral', async function () {
      await expect(this.liquity.connect(user).manageTroveWithApproxHint(minFee, '2000000000000000000000', 2, Math.floor(Math.random() * 10), {value: ethers.utils.parseEther('1')}))
        .to.be.revertedWith("BorrowerOps: An operation that would result in ICR < MCR is not permitted");
    });
    it('reverts when paying off a debt which does not exist', async function () {
      await this.lusd.connect(user2).transfer(userAddress, '1000000');
      await expect(this.liquity.connect(user).repayDebt('1000000', 2, Math.floor(Math.random() * 10), true))
        .to.be.revertedWith('LiquityFacet: User has no trove');
      await this.lusd.connect(user).transfer(user2Address, '1000000');
      await expect(this.liquity.connect(user).repayDebt('10000000', 2, Math.floor(Math.random() * 10), true))
        .to.be.revertedWith('LiquityFacet: Not enough LUSD');
    });
    it('reverts when withdrawing excess debt', async function () {
      const lusdBefore = await this.lusd.totalSupply();
      await this.liquity.connect(user).manageTroveWithApproxHint(minFee, '2000000000000000000000', 2, Math.floor(Math.random() * 10), {value: ethers.utils.parseEther('4')});
      expect((await this.lusd.balanceOf(this.silo.address))/1e18).to.eq(2000);
      await expect(this.liquity.connect(user).manageTroveWithApproxHint(minFee, '2000000000000000000000', 2, Math.floor(Math.random() * 10), {value: ethers.utils.parseEther('0')}))
        .to.be.revertedWith('BorrowerOps: An operation that would result in ICR < MCR is not permitted');

      const lusdAfter = await this.lusd.totalSupply();
      expect((await this.lusd.balanceOf(this.silo.address))/1e18).to.eq(2000);
      expect((lusdAfter.sub(lusdBefore))/1e18).to.eq(2210);
      expect((await this.uniswap.internalBalance(userAddress, this.lusd.address))/1e18).to.eq(2000);
    });
  });
  describe('Borrower Operations', async function () {
    it('opens a trove for a new user', async function () {
      const lusdBefore = await this.lusd.totalSupply();
      await this.liquity.connect(user2).manageTroveWithApproxHint(minFee, '2000000000000000000000', 2, Math.floor(Math.random() * 10), {value: ethers.utils.parseEther('7')});
	    const lusdAfter = await this.lusd.totalSupply();
	    expect((await this.lusd.balanceOf(this.silo.address))/1e18).to.eq(4000);
	    expect((lusdAfter.sub(lusdBefore))/1e18).to.eq(2210);
	    expect((await this.uniswap.internalBalance(userAddress, this.lusd.address))/1e18).to.eq(2000);
	    expect((await this.uniswap.internalBalance(user2Address, this.lusd.address))/1e18).to.eq(2000);
	    expect(await this.liquity.associatedTrove(userAddress)).to.not.eq(await this.liquity.associatedTrove(user2Address));
    });
    it('withdraws funds from an existing trove', async function () {
      await this.liquity.connect(user2).manageTroveWithApproxHint(minFee, '2000000000000000000000', 2, Math.floor(Math.random() * 10), {value: ethers.utils.parseEther('0')});
	    expect((await this.lusd.balanceOf(this.silo.address))/1e18).to.eq(6000);
	    expect((await this.uniswap.internalBalance(user2Address, this.lusd.address))/1e18).to.eq(4000);
	    expect((await this.uniswap.internalBalance(userAddress, this.lusd.address))/1e18).to.eq(2000);
	    expect((await this.lusd.balanceOf(await this.liquity.associatedTrove(user2Address))/1e18)).to.eq(0);
    });
    it('can repay debt', async function () {
	    await this.liquity.connect(user).repayDebt('2000', 2, Math.floor(Math.random() * 10), true);
	    await this.liquity.connect(user2).repayDebt('4000', 2, Math.floor(Math.random() * 10), true);	
    });
  });
  describe('Collateral -> Curve -> Field', async function () {
    beforeEach(async function () {
	    await this.season.setSoilE('1000');
      await this.season.setYieldE('1000');
    });
    it('deposit, swap, and sow', async function () {
      await this.liquity.clearBalance(userAddress);

      this.preBean = await this.bean.balanceOf(userAddress);
	    await this.farm.connect(user).chainFarm(['0xa6d076790000000000000000000000000000000000000000000000000011c37937e0800000000000000000000000000000000000000000000000006c6b935b8bbd4000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a', '0x13d8a565000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d652c40fbb3f06d6b58cb9aa9cff063ee63d465d0000000000000000000000000000000000000000000000000000000000000000', '0x5271978900000000000000000000000000000000000000000000000000000000000003e8'], {value: ethers.utils.parseEther('4')});
	    expect(await this.field.totalPods()).to.eq('11000');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('999998998'); // Almost 1000 Beans. Lost a few due to slippage in curve pool but idea is 2000 LUSD -> 2000 BEAN - 1000 BEANS sown
    });
    it('deposit, swap, and fundraise', async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      await this.fundraiser.createFundraiserE(userAddress, this.bean.address, '1000000');
      expect(await this.field.totalPods()).to.eq('11000');
      await this.farm.connect(user).chainFarm(['0xa6d076790000000000000000000000000000000000000000000000000011c37937e0800000000000000000000000000000000000000000000000006c6b935b8bbd4000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a', '0x13d8a565000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d652c40fbb3f06d6b58cb9aa9cff063ee63d465d0000000000000000000000000000000000000000000000000000000000000000', '0x2db75d40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e8'], {value: ethers.utils.parseEther('4')});
      expect(await this.field.totalPods()).to.eq('22000');
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('999998994'); // Just like one above. It's around 999.9 beans because slippage. Idea is 2000 LUSD -> 2000 BEAN -> 1000 BEAN + 11000 Pods
    });
  });
  describe('Collateral -> Curve -> Silo', async function () {
    it('deposit, swap, and deposit again', async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      expect(await this.silo.totalDepositedBeans()).to.eq('0');
	    await this.farm.connect(user).chainFarm(['0xa6d076790000000000000000000000000000000000000000000000000011c37937e0800000000000000000000000000000000000000000000000006c6b935b8bbd4000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a', '0x13d8a565000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d652c40fbb3f06d6b58cb9aa9cff063ee63d465d0000000000000000000000000000000000000000000000000000000000000000', '0x75ce258d00000000000000000000000000000000000000000000000000000000000003e8'], {value: ethers.utils.parseEther('4')});
      expect(await this.silo.totalDepositedBeans()).to.eq('1000');
	    expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
	    expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2000');
	    expect(await this.silo.totalStalk()).to.eq('10000000');
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('999998991');
    });
  });
  describe('Collateral -> Curve -> Beanstalk Functionality', async function () {
    it('deposit, swap, and wrap beans', async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
	    await this.farm.connect(user).chainFarm(['0xa6d076790000000000000000000000000000000000000000000000000011c37937e0800000000000000000000000000000000000000000000000006c6b935b8bbd4000000000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000a', '0x13d8a565000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000000000000000000000000000d652c40fbb3f06d6b58cb9aa9cff063ee63d465d0000000000000000000000000000000000000000000000000000000000000000', '0xdde7283c00000000000000000000000000000000000000000000000000000000000003e8'], {value: ethers.utils.parseEther('4')});
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('999998987');
	    expect(await this.claim.wrappedBeans(userAddress)).to.eq('1000');
    });
  });
});
