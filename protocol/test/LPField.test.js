const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const {
  expectEvent,  // Assertions for emitted events
  expectRevert, // Assertions for transactions that should fail
} = require('@openzeppelin/test-helpers');
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print } = require('./utils/print.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('LPField Test', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.lpfield = await ethers.getContractAt('MockLPFieldFacet', this.diamond.address)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair)
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair)
    this.bean = await ethers.getContractAt('MockToken', contracts.bean)
    this.weth = await ethers.getContractAt('MockToken', contracts.weth)

    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, '1000000000')
    await this.bean.mint(this.pair.address, '100000')
    await this.weth.mint(this.pair.address, '100')
    await this.pair.connect(user).approve(this.silo.address, '100000000000')
    await this.pair.connect(user2).approve(this.silo.address, '100000000000')
    await this.bean.connect(user).approve(this.silo.address, '100000000000')
    await this.bean.connect(user2).approve(this.silo.address, '100000000000')
    await this.pair.faucet(userAddress, '100');

    // Setting Bean/Eth and USDC/ETHUSDC Pools
    await this.pair.set('100000', '100','10');
    await this.pegPair.set('100000', '100','10');

    await user.sendTransaction({
        to: this.weth.address,
        value: ethers.utils.parseEther("1.0")
    });
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetState()
    await this.season.siloSunrise(0)
  });

  describe('sow Lps', function () {
    beforeEach(async function () {
      await this.field.setFieldAmountsE('1000000', '0', '0');
      const lpTokens = await this.pair.balanceOf(userAddress);
      this.result = await this.lpfield.connect(user).sowLP('1');
      const newLpTokens = await this.pair.balanceOf(userAddress);
      this.sownLps = lpTokens.sub(newLpTokens);

      await this.lpfield.connect(user).sowLP('9');
      const multipleLpTokens = await this.pair.balanceOf(userAddress);
      this.multiSownLps = lpTokens.sub(multipleLpTokens);
    });

    it('properly sows 1 LP', async function () {
      expect(this.sownLps.toString()).to.equal('1');
    });

    it('properly sows multiple LPs', async function () {
      expect(this.multiSownLps.toString()).to.equal('10');
    });

    it('properly reverts oversowing LPs', async function () {
      this.result = await expect(this.lpfield.connect(user).sowLP('100')).to.be.revertedWith('ERC20: transfer amount exceeds balance')
    });
  })

  describe('claimLps', function () {
    beforeEach(async function () {
      await this.silo.connect(user).depositBeans('1000')
      await this.silo.connect(user).depositLP('10')
      await this.field.setFieldAmountsE('1000000', '0', '0')
      await this.field.incrementTotalHarvestableE('1000')
      await this.silo.connect(user).withdrawBeans([1, 2],['1000', '1000'])
      await this.silo.connect(user).withdrawLP([1, 2],['5', '5'])
      await this.season.farmSunrises('25')
    });

    describe('claim and sow LP', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        // Convert LP flag enabled
        this.result = await this.lpfield.connect(user).claimAndSowLP('1', [[],['1'],[],false,true,'0','0'])
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims lp', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates lp', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        expect(this.result).to.emit(this.field, 'Sow').withArgs(userAddress, '1000', '1000', '1000');
      });
    });

    describe('claim, buy and sow LP, exact allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.lpfield.connect(user).claimAddAndSowLP('1', '8000', '2', ['5000', '4000', '1'], [['27'],[],[],false,true,'0','0'])
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
        expect(this.result).to.emit(this.field, 'Sow').withArgs(userAddress, '1000', '1990', '1990');
      });
    });

    describe('claim, buy and sow LP, over allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','0', ['1000','1000','1'],[['27'],[],['0'],false,true,'0','0'], {value: '1'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('1000');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
    });

    describe('claim, buy and sow LP, under allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','0', ['2000','2000','2'],[['27'],[],[],false,true,'0','0'], {value: '2'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('-1000');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
    });

    describe('add and sow LP, exact allocation', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = this.silo.connect(user).claimAddAndDepositLP('0','0','0', ['1000','1000','1'],[['27'],[],[],false,true,'0','0'], {value: '1'});
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.sub(beans)
      });
      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('0');
      });
      it('properly allocates beans', async function () {
        expect(this.result).to.emit(this.claim, 'BeanAllocation').withArgs(userAddress, '1000');
      });
    });

  });
});
