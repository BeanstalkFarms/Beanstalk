const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

describe('Farm', function () {
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
    this.farm = await ethers.getContractAt('MockFarmFacet', this.diamond.address);
    this.fundraiser = await ethers.getContractAt('MockFundraiserFacet', this.diamond.address)

    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, '1000000000')
    await this.pair.connect(user).approve(this.silo.address, '100000000000')
    await this.pair.connect(user2).approve(this.silo.address, '100000000000')
    await this.bean.connect(user).approve(this.silo.address, '100000000000')
    await this.bean.connect(user2).approve(this.silo.address, '100000000000')
    await this.weth.connect(user).approve(this.silo.address, '100000000000');

    await user.sendTransaction({
        to: this.weth.address,
        value: ethers.utils.parseEther("1.0")
    });
  });

  beforeEach (async function () {
    await this.pair.burnAllLP(userAddress);
    await this.pair.burnAllLP(this.silo.address);
    await this.pair.burnTokens(this.bean.address);
    await this.pair.burnWETH(this.weth.address);
    await this.pair.set('9000000', '1000000','1');
    await this.weth.mint(this.pair.address, '1000000');
    await this.bean.mint(this.pair.address, '9000000');
    await this.season.siloSunrise(0)
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetWrappedBeans([userAddress, user2Address, ownerAddress])
    await this.season.resetState()
    await this.season.siloSunrise(0)
  });

  describe('Silo Facet', function () {
   beforeEach(async function () {	
	await this.farm.connect(user).farm('0x75ce258d00000000000000000000000000000000000000000000000000000000000003e8') // depositBeans(1000)
	await this.farm.connect(user2).farm('0x75ce258d00000000000000000000000000000000000000000000000000000000000003e8') // depositBeans(1000)
   });
	it('deposit beans', async function () {
	expect(await this.silo.totalDepositedBeans()).to.eq('2000');
	expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
	expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2000');
	expect(await this.silo.totalStalk()).to.eq('20000000');
   });
   it('withdraw beans', async function () {
	await this.farm.connect(user).farm('0xf4bf29080000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000003e8'); // withdrawBeans([2], [1000])
	expect(await this.silo.totalDepositedBeans()).to.eq('1000');
	expect(await this.silo.balanceOfStalk(userAddress)).to.eq('0');
	expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('0');
	expect(await this.silo.totalStalk()).to.eq('10000000');
   });
   it('interact with existing deposits', async function () {
	await this.season.siloSunrise('10');
	expect(await this.silo.totalDepositedBeans()).to.eq('2010');
	expect(await this.silo.balanceOfStalk(user2Address)).to.eq('10050000');
	expect(await this.silo.balanceOfSeeds(user2Address)).to.eq('2010');
   });
  });
  describe('Field Facet', function () {
   it('sow beans', async function () {
	this.preSupply = await this.bean.balanceOf(userAddress);
	await this.season.setSoilE('1000');
	await this.season.setYieldE('1000');
	await this.farm.connect(user).farm('0x5271978900000000000000000000000000000000000000000000000000000000000003e8'); // sowBeans(1000)
	expect(await this.field.totalPods()).to.eq('11000');
	expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq(-1000);
   });
  });
  describe('Uniswap Facet', function () {
   it('swap tokens: weth -> bean', async function () {
	this.preSupply = await this.bean.balanceOf(userAddress);
	this.wethPre = await this.weth.balanceOf(userAddress);
	   console.log(await this.bean.totalSupply());
	   console.log(await this.bean.balanceOf(userAddress));
	   console.log(await this.bean.balanceOf(this.pair.address));
	   console.log(await this.bean.balanceOf(this.silo.address));
	this.preSupply = await this.bean.balanceOf(userAddress);
	await this.farm.connect(user).farm('0xeb5428f9000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000003d4'); // swapOnUniswap(weth, 1, 980)
	console.log(await this.bean.totalSupply());
	   console.log(await this.bean.balanceOf(userAddress));
	   console.log(await this.bean.balanceOf(this.pair.address));
	   console.log(await this.bean.balanceOf(this.silo.address));
	this.preSupply = await this.bean.balanceOf(userAddress);
	expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('988');
	expect((await this.weth.balanceOf(userAddress)).sub(this.wethPre)).to.eq(-1);
   });
   it('buy tokens: ETH -> bean', async function () {
	   console.log(await this.bean.totalSupply());
	   console.log(await this.bean.balanceOf(userAddress));
	   console.log("P " + await this.bean.balanceOf(this.pair.address));
	   console.log("S " + await this.bean.balanceOf(this.silo.address));
	this.preSupply = await this.bean.balanceOf(userAddress);
	await this.farm.connect(user).farm('0x058a24c700000000000000000000000000000000000000000000000000000000000003d4', {value: ethers.utils.parseEther('10')}); // buyBeansOnUniswap(980)
	   console.log(await this.bean.totalSupply());
	   console.log("user " + await this.bean.balanceOf(userAddress));
	   console.log("PAir " + await this.bean.balanceOf(this.pair.address));
	   console.log(" SIlo " + await this.bean.balanceOf(this.silo.address));
	expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('988');
   });
  });
  describe('Fundraiser Facet', function () {
   it('fund an existing fundraiser', async function () {
	this.preSupply = await this.bean.balanceOf(userAddress);
	await this.season.setSoilE('1000');
	await this.season.setYieldE('2000');
	await this.fundraiser.createFundraiserE(userAddress, this.bean.address, '1000');
	expect(await this.field.totalPods()).to.eq('0');
	await this.farm.connect(user).farm('0x2db75d40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e8'); // fund(0, 1000)
	expect(await this.field.totalPods()).to.eq('21000');
	expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq(-1000);
   });
  });
  describe('Claim Facet', function () {
   it('unwrap beans', async function () {
	await this.claim.connect(user).wrapBeans('1000');
	this.former = await this.claim.wrappedBeans(userAddress);
	this.balance = await this.bean.balanceOf(userAddress);
	await this.farm.connect(user).farm('0x4586795200000000000000000000000000000000000000000000000000000000000003e8'); // unwrapBeans(1000)
	expect((await this.claim.wrappedBeans(userAddress)).sub(this.former)).to.eq(-1000);
	expect((await this.bean.balanceOf(userAddress)).sub(this.balance)).to.eq(1000);
   });
   it('wrap beans', async function () {
	this.former = await this.claim.wrappedBeans(userAddress);
	this.balance = await this.bean.balanceOf(userAddress);
	await this.farm.connect(user).farm('0xdde7283c00000000000000000000000000000000000000000000000000000000000003e8'); // wrapBeans(1000)
	expect((await this.claim.wrappedBeans(userAddress)).sub(this.former)).to.eq(1000);
	expect((await this.bean.balanceOf(userAddress)).sub(this.balance)).to.eq(-1000);
   });
  });
});
