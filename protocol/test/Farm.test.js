const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

const BEAN = '0xDC59ac4FeFa32293A95889Dc396682858d52e5Db';
const ZERO = "0x0000000000000000000000000000000000000000";
const BEAN_3CRV = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";
const THREE_CRV = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

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
    this.bean = await ethers.getContractAt('MockToken', BEAN)
    this.weth = await ethers.getContractAt('MockToken', contracts.weth)
    this.farm = await ethers.getContractAt('MockFarmFacet', this.diamond.address);
    this.uniswap = await ethers.getContractAt('MockUniswapFacet', this.diamond.address);
    this.fundraiser = await ethers.getContractAt('MockFundraiserFacet', this.diamond.address)
    this.bean3curve = await ethers.getContractAt('MockCurvePool', BEAN_3CRV);
    this.threecurve = await ethers.getContractAt('MockToken', THREE_CRV);
    this.curve = await ethers.getContractAt('MockCurveFacet', this.diamond.address);
    this.liquity = await ethers.getContractAt('MockLiquityFacet', this.diamond.address);
    
    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, ethers.utils.parseUnits('1', 30));
    await this.threecurve.mint(user2Address, ethers.utils.parseUnits('1', 30));
    await this.pair.connect(user).approve(this.silo.address, ethers.utils.parseUnits('1', 50))
    await this.pair.connect(user2).approve(this.silo.address, ethers.utils.parseUnits('1', 50))
    await this.bean.connect(user).approve(this.silo.address, ethers.utils.parseUnits('1', 50))
    await this.bean.connect(user2).approve(this.silo.address, ethers.utils.parseUnits('1', 50))
    await this.weth.connect(user).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.threecurve.connect(user2).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.threecurve.connect(user).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.bean3curve.connect(user).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.bean3curve.connect(user2).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.pair.set('20000', '20000','1');
    await this.bean3curve.initialize("Bean-3Curve", "BEAN:3CRV", [BEAN, THREE_CRV, ZERO, ZERO], [ethers.utils.parseUnits('1', 30), ethers.utils.parseEther('1'), 0, 0], '100', '5000000000');

    await user.sendTransaction({
        to: this.weth.address,
        value: ethers.utils.parseEther("1.0")
    });

    await this.curve.connect(user2).addLiquidityCurve([ethers.utils.parseUnits('1', 18), ethers.utils.parseUnits('1', 28)], 1, BEAN_3CRV, false, false);
  });

  beforeEach (async function () {
    await this.pair.burnAllLP(userAddress);
    await this.pair.burnAllLP(this.silo.address);
    await this.pair.burnTokens(this.bean.address);
    await this.pair.burnWETH(this.weth.address);
    await this.season.siloSunrise(0)
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.season.resetWrappedBeans([userAddress, user2Address, ownerAddress])
    await this.season.resetState()
    await this.season.siloSunrise(0)
    await this.weth.mint(this.pair.address, '20000');
    await this.bean.mint(this.pair.address, '20000');
    await this.pair.simulateTrade('20000', '20000');
  });

  describe("Sanity Checks", async function () {
    it('fails when given non-public/external function', async function () {
      expect(await this.farm.connect(user).chainFarm(['0x94b3ee8f0000000000000000000000000000000000000000000000000000000000000000']));
    });
    it('reverts when supplied more beans than the user owns', async function () {
      await expect(this.farm.connect(user).chainFarm(['0x75ce258d00000000000000000000000000000000000000000052b7d2dcc80cd2e4000000']))
        .to.be.revertedWith('FarmFacet: Function call failed!');
    });
  });
  describe('Silo Facet', function () {
    beforeEach(async function () {	
	    await this.farm.connect(user).chainFarm(['0x75ce258d00000000000000000000000000000000000000000000000000000000000003e8']) // depositBeans(1000)
	    await this.farm.connect(user2).chainFarm(['0x75ce258d00000000000000000000000000000000000000000000000000000000000003e8']) // depositBeans(1000)
   });
	  it('deposit beans', async function () {
	    expect(await this.silo.totalDepositedBeans()).to.eq('2000');
	    expect(await this.silo.balanceOfStalk(userAddress)).to.eq('10000000');
	    expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('2000');
	    expect(await this.silo.totalStalk()).to.eq('20000000');
    });
    it('withdraw beans', async function () {
	    await this.farm.connect(user).chainFarm(['0xf4bf29080000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000008000000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000003e8']); // withdrawBeans([2], [1000])
	    expect(await this.silo.totalDepositedBeans()).to.eq('1000');
	    expect(await this.silo.balanceOfStalk(userAddress)).to.eq('0');
	    expect(await this.silo.balanceOfSeeds(userAddress)).to.eq('0');
	    expect(await this.silo.totalStalk()).to.eq('10000000');
    });
    it('updates existing deposits', async function () {
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
	    await this.farm.connect(user).chainFarm(['0x5271978900000000000000000000000000000000000000000000000000000000000003e8']); // sowBeans(1000)
	    expect(await this.field.totalPods()).to.eq('11000');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('-1000');
    });
  });
  describe('Uniswap Facet', function () {
    it('swap tokens: ANY -> BEAN', async function () {
	    this.wethPre = await this.weth.balanceOf(userAddress);
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    await this.farm.connect(user).chainFarm(['0xeb5428f9000000000000000000000000c02aaa39b223fe8d0a0e5c4f27ead9083c756cc200000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000003ac']); // swapOnUniswap(weth, 1000, 940)
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('0');
	    expect((await this.weth.balanceOf(userAddress)).sub(this.wethPre)).to.eq('-1000');
	    expect(await this.uniswap.internalBalance(userAddress, this.bean.address)).to.eq('949');
    });
    it('buy tokens: ETH -> BEAN', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    await this.farm.connect(user).chainFarm(['0xa5c5ceab00000000000000000000000000000000000000000000000000000000000003ac00000000000000000000000000000000000000000000000000000000000003e8'], {value: '1000'}); // buyBeansOnUniswap(940)
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('0');
	    expect(await this.uniswap.internalBalance(userAddress, this.bean.address)).to.eq('949');
    });
    it('sell tokens: BEAN -> ETH', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    await this.farm.connect(user).chainFarm(['0x18e257ea00000000000000000000000000000000000000000000000000000000000003e80000000000000000000000000000000000000000000000000000000000000001']); // sellBeansOnUniswap(1000, 1)
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('-1000');
    	expect(await this.uniswap.internalBalance(userAddress, this.weth.address)).to.eq('949');
    });
  });
  describe('Curve Facet', function () {
    it('can add liquidity to a curve pool', async function () {
      this.preBean = await this.bean.balanceOf(user2Address);
      this.preLP = await this.bean3curve.balanceOf(user2Address);
      this.pre3Crv = await this.threecurve.balanceOf(user2Address);
      await this.farm.connect(user2).chainFarm(['0xd7a1defb00000000000000000000000000000000000000000000000000000000000000a000000000000000000000000000000000000000000000000000000000000000010000000000000000000000003a70dfa7d2262988064a2d051dd47521e43c9bdd00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000038d7ea4c6800000000000000000000000000000000000000000000000000000038d7ea4c68000']);
      expect((await this.bean.balanceOf(user2Address)).sub(this.preBean)).to.eq('-1000000000000000');
      expect((await this.bean3curve.balanceOf(user2Address)).sub(this.preLP)).to.eq('799370393550770461181657080'); // LP is so wack because liquidity added was imbalanced
      expect((await this.threecurve.balanceOf(user2Address)).sub(this.pre3Crv)).to.eq('-1000000000000000'); 
    });
    it('can swap from one token to another', async function () {
      this.preBean = await this.bean.balanceOf(user2Address);
      this.pre3Crv = await this.threecurve.balanceOf(user2Address);
      await this.farm.connect(user2).chainFarm(['0x16a773360000000000000000000000000000000000000000000000056bc75e2d6310000000000000000000000000000000000000000000000000000000000000000f4240000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000003a70dfa7d2262988064a2d051dd47521e43c9bdd00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000']);
      expect((await this.threecurve.balanceOf(user2Address)).sub(this.pre3Crv)).to.eq('-100000000000000000000');
      expect((await this.bean.balanceOf(user2Address)).sub(this.preBean)).to.eq('487166852');
    });
    it('can remove liquidity', async function () {
      this.preBean = await this.bean.balanceOf(user2Address);
      this.preLP = await this.bean3curve.balanceOf(user2Address);
      this.pre3Crv = await this.threecurve.balanceOf(user2Address);
      await this.farm.connect(user2).chainFarm(['0x15a81e930000000000000000000000000000000000000000000000056bc75e2d6310000000000000000000000000000000000000000000000000000000000000000000a00000000000000000000000003a70dfa7d2262988064a2d051dd47521e43c9bdd0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000005f5e1000000000000000000000000000000000000000000000000000000000000000000']);
      expect((await this.bean3curve.balanceOf(user2Address)).sub(this.preLP)).to.eq('-100000000000000000000');
      expect((await this.bean.balanceOf(user2Address)).sub(this.preBean)).to.eq('100000000');
      expect((await this.threecurve.balanceOf(user2Address)).sub(this.pre3Crv)).to.eq('0');
    });
  });
  describe('Fundraiser Facet', function () {
    it('fund an existing fundraiser', async function () {
	    await this.season.setSoilE('1000');
	    await this.season.setYieldE('2000');
	    await this.fundraiser.createFundraiserE(userAddress, this.bean.address, '1000000');
	    expect(await this.field.totalPods()).to.eq('0');
	    this.preSupply = await this.bean.balanceOf(userAddress);
	    await this.farm.connect(user).chainFarm(['0x2db75d40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003e8']); // fund(0, 1000)
	    expect(await this.field.totalPods()).to.eq('21000');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('-1000');
    });
  });
  describe('Claim Facet', function () {
    it('unwrap beans', async function () {
	    await this.claim.connect(user).wrapBeans('1000');
	    this.former = await this.claim.wrappedBeans(userAddress);
	    this.balance = await this.bean.balanceOf(userAddress);
	    await this.farm.connect(user).chainFarm(['0x4586795200000000000000000000000000000000000000000000000000000000000003e8']); // unwrapBeans(1000)
	    expect((await this.claim.wrappedBeans(userAddress)).sub(this.former)).to.eq(-1000);
	    expect((await this.bean.balanceOf(userAddress)).sub(this.balance)).to.eq(1000);
    });
    it('wrap beans', async function () {
	    this.former = await this.claim.wrappedBeans(userAddress);
	    this.balance = await this.bean.balanceOf(userAddress);
	    await this.farm.connect(user).chainFarm(['0xdde7283c00000000000000000000000000000000000000000000000000000000000003e8']); // wrapBeans(1000)
	    expect((await this.claim.wrappedBeans(userAddress)).sub(this.former)).to.eq(1000);
	    expect((await this.bean.balanceOf(userAddress)).sub(this.balance)).to.eq(-1000);
    });
  });
  describe('Farm Facet: Do not use all ETH', async function () {
    it('buys beans: excess ETH', async function () {
	    this.preSupply = await this.bean.balanceOf(userAddress);
      this.ether = await user.getBalance();
	    await this.farm.connect(user).chainFarm(['0xa5c5ceab00000000000000000000000000000000000000000000000000000000000003ac00000000000000000000000000000000000000000000000000000000000003e8'], {value: '4000'});
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq('0');
	    expect(await this.uniswap.internalBalance(userAddress, this.bean.address)).to.eq('949');
      expect((await user.getBalance()).sub(this.ether)).to.eq('-165286001323288'); // This number is weird but I 
      // unfortunately cannot predict gas, so you can test this by changing the {value: x} in the function calls and seeing it remains the same.
    });
    it('adds liquidity: excess ETH', async function () {
      this.preSupply = await this.bean.balanceOf(userAddress);
      this.ether = await user.getBalance();
      this.preWeth = await this.weth.balanceOf(userAddress);
	    await this.farm.connect(user).chainFarm(['0x397f07bf00000000000000000000000000000000000000000000000000000000000003e800000000000000000000000000000000000000000000000000000000000003d400000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000de0b6b3a7640000'], {value: ethers.utils.parseEther('5')}); // Excess of 4 ETH
      expect(await this.pair.balanceOf(userAddress)).to.eq('1');
	    expect((await this.bean.balanceOf(userAddress)).sub(this.preSupply)).to.eq(-1000);
	    expect((await this.weth.balanceOf(userAddress)).sub(this.preWeth)).to.eq('0') // ETH added
      expect((await user.getBalance()).sub(this.ether)).to.eq('-180717001446736');
    });
  });
});
