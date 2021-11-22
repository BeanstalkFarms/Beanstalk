const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { BigNumber } = require('bignumber.js')
const { print } = require('./utils/print.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('BIP2', function () {
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
    await this.pair.set('100000', '100','1');

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

  describe('claimBeans', function () {
    beforeEach(async function () {
      await this.silo.connect(user).depositBeans('1000')
      await this.silo.connect(user).depositLP('1')
      await this.field.incrementTotalSoilEE('5000')
      await this.field.connect(user).sowBeans('1000')
      await this.field.incrementTotalHarvestableE('1000')
      await this.silo.connect(user).withdrawBeans([2],['1000'])
      await this.silo.connect(user).withdrawLP([2],['1'])
      await this.season.farmSunrises('25')
    });

    describe('claim', function () {
      beforeEach(async function () {
        const beans = await this.bean.balanceOf(userAddress)
        this.result = await this.claim.connect(user).claim([['27'],[],[],false,true,'0','0'])
        const newBeans = await this.bean.balanceOf(userAddress)
        this.claimedBeans = newBeans.minus(beans)
      });

      it('properly claims beans', async function () {
        expect(this.claimedBeans.toString()).to.equal('1000');
      });
    });
  });
});
