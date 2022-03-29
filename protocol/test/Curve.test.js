const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

const BEAN_LUSD = "0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D";
const BEAN = '0xDC59ac4FeFa32293A95889Dc396682858d52e5Db';
const LUSD = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
const ZERO = "0x0000000000000000000000000000000000000000"

describe('Curve', function () {
  before(async function () {
    [owner,user,user2] = await ethers.getSigners();
    userAddress = user.address;
    user2Address = user2.address;
    const contracts = await deploy("Test", false, true);
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.weth = await ethers.getContractAt('MockToken', contracts.weth);
    this.silo = await ethers.getContractAt("MockSiloFacet", this.diamond.address);
    this.season = await ethers.getContractAt("MockSeasonFacet", this.diamond.address);
    this.lusd = await ethers.getContractAt("MockLUSDToken", LUSD);
    this.curve = await ethers.getContractAt('MockCurveFacet', this.diamond.address);
    this.beanLusd = await ethers.getContractAt("MockBEAN-LUSD", BEAN_LUSD);

    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, '1000000000')
    await this.bean.mint(user2Address, '10000000000000')
    await this.bean.connect(user).approve(this.silo.address, '100000000000')
    await this.weth.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.beanLusd.address, '100000000000');
    await this.lusd.connect(user).approve(this.beanLusd.address, '100000000000');
    await this.lusd.mintE(user2Address, '10000000000000');
    await this.beanLusd.initialize("Bean-LUSD", "BEAN:LUSD", [BEAN, LUSD, ZERO, ZERO], [1, 1, 0, 0], '10000', '5000000000');

    await user.sendTransaction({
        to: this.weth.address,
        value: ethers.utils.parseEther("1.0")
    });
  });

  beforeEach (async function () {
    await this.season.siloSunrise(0);
  });
    describe("Add Liquidity", async function () {
    it("adds liquidity to BEAN3CRV", async function () {
    });
    it("adds liquidity to BEANLUSD", async function () {
      await this.curve.connect(user).addLiquidityCurve(['100000000', '1000000000'], 1, BEAN_LUSD);
    });
  });
  describe("Swap", async function () {
    it("swaps from BEAN -> LUSD", async function () {
      await this.curve.connect(user).swapOnCurve('1000', '900', 0, 1, BEAN_LUSD);
    });
    it("swaps from LUSD -> BEAN", async function () {
      await this.curve.connect(user).swapOnCurve('1000', '900', 1, 0, BEAN_LUSD); 
    });
  });
});
