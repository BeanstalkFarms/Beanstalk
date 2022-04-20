const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
const { ConvertEncoder } = require('./utils/encoder.js')
const { to18, toBean, toStalk } = require('./utils/helpers.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

const THREE_CURVE = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const BEAN_3_CURVE = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";
const LUSD_3_CURVE = "0xEd279fDD11cA84bEef15AF5D39BB4d4bEE23F0cA";
const BEAN_LUSD_CURVE = "0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D";
const LUSD = '0x5f98805A4E8be255a32880FDeC7F6728C6568bA0';

describe('Curve Convert', function () {
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
    this.silov2 = await ethers.getContractAt('SiloV2Facet', this.diamond.address);
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond.address);
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.lusd = await ethers.getContractAt('MockToken', LUSD);
    this.weth = await ethers.getContractAt('MockToken', contracts.weth);
    this.threeCurve = await ethers.getContractAt('Mock3Curve', THREE_CURVE);
    this.beanMetapool = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
    this.lusdMetapool = await ethers.getContractAt('MockMeta3Curve', LUSD_3_CURVE);
    this.beanLUSD = await ethers.getContractAt('MockPlainCurve', BEAN_LUSD_CURVE);

    await this.threeCurve.mint(userAddress, to18('100000'));
    await this.threeCurve.set_virtual_price(ethers.utils.parseEther('1'));
    await this.beanMetapool.set_A_precise('1000');
    await this.beanMetapool.set_virtual_price(ethers.utils.parseEther('1'));
    await this.lusdMetapool.set_A_precise('1000');
    await this.lusdMetapool.set_virtual_price(ethers.utils.parseEther('1'));
    await this.beanLUSD.set_A_precise('10000');
    await this.beanLUSD.set_virtual_price(ethers.utils.parseEther('1'));

    await this.pair.set('10000', '40000', '1');
    await this.pegPair.simulateTrade('20000', '20000');
    await this.season.siloSunrise(0);
    await this.pair.faucet(userAddress, '1');
    await this.lusd.mint(userAddress, to18('1000000000'));
    await this.bean.mint(userAddress, toBean('1000000000'));
    await this.bean.mint(user2Address, toBean('1000000000'));
    await this.lusd.connect(user).approve(this.beanLUSD.address, to18('100000000000'));
    await this.bean.connect(user).approve(this.beanLUSD.address, to18('100000000000'));
    await this.lusd.connect(user).approve(this.lusdMetapool.address, to18('100000000000'));
    await this.bean.connect(user).approve(this.beanMetapool.address, to18('100000000000'));
    await this.threeCurve.connect(user).approve(this.beanMetapool.address, to18('100000000000'));
    await this.threeCurve.connect(user).approve(this.lusdMetapool.address, to18('100000000000'));
    await this.beanMetapool.connect(user).approve(this.threeCurve.address, to18('100000000000'));
    await this.beanMetapool.connect(user).approve(this.silo.address, to18('100000000000'));
    await this.pair.connect(user).approve(this.silo.address, '100000000000');
    await this.pair.connect(user2).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000');
  });

  beforeEach (async function () {
    await this.season.resetAccount(userAddress)
    await this.season.resetAccount(user2Address)
    await this.season.resetAccount(ownerAddress)
    await this.pair.burnAllLP(this.silo.address);
    await this.pair.burnAllLP(userAddress);
    await this.pair.burnAllLP(user2Address);
    await this.pair.burnAllLP(ownerAddress);
    await this.pair.burnTokens(this.bean.address);
    await this.pair.burnTokens(this.weth.address);
    await this.beanMetapool.reset();
    await this.lusdMetapool.reset();
    await this.beanLUSD.reset();
    await this.season.resetState();
    await this.season.siloSunrise(0);
    await this.beanMetapool.connect(user).add_liquidity([toBean('1000'), to18('1000')], to18('2000'));
    await this.beanMetapool.connect(user).add_liquidity([toBean('1'), to18('1')], to18('1'));
    await this.lusdMetapool.connect(user).add_liquidity([to18('1000'), to18('1000')], to18('2000'));
    await this.lusdMetapool.connect(user).add_liquidity([to18('1'), to18('1')], to18('1'));
    await this.beanLUSD.connect(user).add_liquidity([toBean('1000'), to18('1000')], to18('2000'));
  });

  describe('calclates beans to peg', async function () {
    it('p > 1', async function () {
      await this.beanLUSD.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      expect(await this.convert.beansToPeg(this.beanLUSD.address)).to.be.equal(ethers.utils.parseUnits('200', 6));
    });

    it('p = 1', async function () {
      expect(await this.convert.beansToPeg(this.beanLUSD.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.beanLUSD.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
      expect(await this.convert.beansToPeg(this.beanLUSD.address)).to.be.equal('0');
    });
  });

  describe('calclates lp to peg', async function () {
    it('p > 1', async function () {
      await this.beanLUSD.connect(user).add_liquidity([toBean('0'), to18('200')], to18('150'));
      expect(await this.convert.lpToPeg(this.beanLUSD.address)).to.be.equal('0');
    });

    it('p = 1', async function () {
      expect(await this.convert.lpToPeg(this.beanLUSD.address)).to.be.equal('0');
    });

    it('p < 1', async function () {
      await this.beanLUSD.connect(user).add_liquidity([toBean('200'), to18('0')], to18('150'));
      expect(await this.convert.lpToPeg(this.beanLUSD.address)).to.be.equal('2000000');
    });
  })
});
