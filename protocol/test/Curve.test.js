const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')

let user,user2,owner;
let userAddress, ownerAddress, user2Address;

const BEAN_LUSD = "0xD652c40fBb3f06d6B58Cb9aa9CFF063eE63d465D";
const BEAN = '0xDC59ac4FeFa32293A95889Dc396682858d52e5Db';
const LUSD = "0x5f98805A4E8be255a32880FDeC7F6728C6568bA0";
const ZERO = "0x0000000000000000000000000000000000000000";
const BEAN_3CRV = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";
const THREE_CRV = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";

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
    this.beanLusd = await ethers.getContractAt("MockCurvePool", BEAN_LUSD);
    this.bean3crv = await ethers.getContractAt("MockCurvePool", BEAN_3CRV);
    this.threecurve = await ethers.getContractAt('MockToken', THREE_CRV);
    this.uniswap = await ethers.getContractAt("MockUniswapFacet", this.diamond.address);

    await this.season.siloSunrise(0)
    await this.bean.mint(userAddress, ethers.utils.parseUnits('1000000000000', 6))
    await this.bean.connect(user).approve(this.silo.address, ethers.utils.parseUnits('100000000000000000000', 6))
    await this.lusd.connect(user).approve(this.silo.address, ethers.utils.parseUnits('10000000000000000000000', 18));
    await this.threecurve.connect(user).approve(this.silo.address, ethers.utils.parseUnits('10000000000000000000', 18));
    await this.beanLusd.connect(user).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.bean3crv.connect(user).approve(this.silo.address, ethers.utils.parseUnits('1', 50));
    await this.lusd.mintE(userAddress, ethers.utils.parseUnits('10000000000000', 18));
    await this.threecurve.mint(userAddress, ethers.utils.parseUnits('100000000000000', 18));
    await this.beanLusd.initialize("Bean-LUSD", "BEAN:LUSD", [BEAN, LUSD, ZERO, ZERO], [ethers.utils.parseUnits('1', 30), ethers.utils.parseEther('1'), 0, 0], '100', '5000000000');
    await this.bean3crv.initialize("Bean-3Curve", "BEAN:3CRV", [BEAN, THREE_CRV, ZERO, ZERO], [ethers.utils.parseUnits('1', 30), ethers.utils.parseEther('1'), 0, 0], '100', '5000000000');

    await user.sendTransaction({
        to: this.weth.address,
        value: ethers.utils.parseEther("1.0")
    });
  });

  beforeEach (async function () {
    await this.season.siloSunrise(0);
  });
describe("Sanity Checks", function () {
  describe("Revert", async function () {
    it("reverts when requesting too much LP from add liquidity", async function () {
      await expect(this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), ethers.utils.parseUnits('10000000000', 18)], ethers.utils.parseUnits('1', 29), BEAN_LUSD, false, false))
        .to.be.revertedWith('Slippage screwed you');
      await expect(this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), ethers.utils.parseUnits('10000000000', 18)], ethers.utils.parseUnits('1', 29), BEAN_3CRV, false, false))
        .to.be.revertedWith('Slippage screwed you');
    });
    it("reverts when requesting too many tokens from remove liquidity", async function () {
      await this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_LUSD, false, false);
      await this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_3CRV, false, false);
      await expect(this.curve.connect(user).removeLiquidityCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 12), ethers.utils.parseUnits('10000000000', 18)], BEAN_LUSD, false, false))
        .to.be.revertedWith('Withdrawal resulted in fewer coins than expected');
      await expect(this.curve.connect(user).removeLiquidityCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 12), ethers.utils.parseUnits('10000000000', 18)], BEAN_3CRV, false, false))
        .to.be.revertedWith('Withdrawal resulted in fewer coins than expected');

      // Imbalanced withdrawls will revert with no reason string because the MinEndAmount array is too high.
      await expect(this.curve.connect(user).removeLiquidityImbalanceCurve('10000000000000000000000000000', ['0', ethers.utils.parseUnits('10000000000', 30)], BEAN_LUSD, false, false))
        .to.be.revertedWith('Transaction reverted without a reason string');
      await expect(this.curve.connect(user).removeLiquidityImbalanceCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 30), '0'], BEAN_3CRV, false, false))
        .to.be.revertedWith('Transaction reverted without a reason string');
    });
    it("reverts when requesting too much of one token from a swap", async function () {
      await expect(this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 6), ethers.utils.parseUnits('90', 19), 0, 1, BEAN_LUSD, false, false))
        .to.be.revertedWith('Exchange resulted in fewer coins than expected');
      await expect(this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 6), ethers.utils.parseUnits('90', 19), 0, 1, BEAN_3CRV, false, false))
        .to.be.revertedWith('Exchange resulted in fewer coins than expected');
    });
    it("reverts when supplying an out-of-bounds index", async function () {
      await expect(this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 6), ethers.utils.parseUnits('90', 9), 0, 2, BEAN_LUSD, false, false))
        .to.be.revertedWith('Transaction reverted without a reason string');
      await expect(this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 6), ethers.utils.parseUnits('90', 9), 0, 2, BEAN_3CRV, false, false))
        .to.be.revertedWith('Transaction reverted without a reason string');
    });
  });
});
describe("External Balances", function () {
  describe("Add Liquidity -> BEAN:LUSD", async function () {
    it("adds liquidity to BEAN:LUSD two tokens", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_LUSD, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-10000000000000000');
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('-10000000000000000000000000000')
    });
    it("adds liquidity to BEAN:LUSD LUSD token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve(['0', ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_LUSD, false, false);
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('-10000000000000000000000000000')
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('0');
    });
    it("adds liquidity to BEAN:LUSD BEAN token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), '0'], 1, BEAN_LUSD, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-10000000000000000');
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('0');
    });
  });
  describe("Add Liquidity -> BEAN:3CRV", async function () {
    it("adds liquidity to BEAN:3CRV two tokens", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_3CRV, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-10000000000000000');
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('-10000000000000000000000000000');
    });
    it("adds liquidity to BEAN:3CRV 3CRV token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve(['0', ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_3CRV, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('0');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('-10000000000000000000000000000');
    });
    it("adds liquidity to BEAN:3CRV BEAN token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), '0'], 1, BEAN_3CRV, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-10000000000000000');
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('0');
    });
  });
  describe("Swap -> BEAN:LUSD", async function () {
    it("swaps from BEAN -> LUSD", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 6), ethers.utils.parseUnits('90', 18), 0, 1, BEAN_LUSD, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-1000000000');
    });
    it("swaps from LUSD -> BEAN", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 18), ethers.utils.parseUnits('90', 6), 1, 0, BEAN_LUSD, false, false); 
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('-1000000000000000000000');
    });
  });
  describe("Swap -> BEAN:3CRV", async function () {
    it("swaps from BEAN -> 3CRV", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.pre3CRV = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 6), ethers.utils.parseUnits('90', 18), 0, 1, BEAN_3CRV, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-1000000000');
    });
    it("swaps from 3CRV -> BEAN", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 18), ethers.utils.parseUnits('90', 6), 1, 0, BEAN_3CRV, false, false); 
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('-1000000000000000000000');
    });
  });
  describe("Remove Liquidity -> BEAN:LUSD", async function () {
    it("removes liquidity to BEAN:LUSD two tokens", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 5), ethers.utils.parseUnits('10000000000', 17)], BEAN_LUSD, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('1000000000000000000000000000')
    });
    it("removes liquidity to BEAN:LUSD LUSD token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityImbalanceCurve('10000000000000000000000000000', ['0', ethers.utils.parseUnits('10000000000', 17)], BEAN_LUSD, false, false);
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('10000000000000000000000000000')
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('0');
    });
    it("removes liquidity to BEAN:LUSD BEAN token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityImbalanceCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 5), '0'], BEAN_LUSD, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('0');
    });
  });
  describe("Remove Liquidity -> BEAN:3CRV", async function () {
    it("removes liquidity to BEAN:3CRV both tokens", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 5), ethers.utils.parseUnits('10000000000', 17)], BEAN_3CRV, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.bean3crv.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('1000000000000000000000000000');
    });
    it("removes liquidity to BEAN:3CRV 3CRV token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityImbalanceCurve('10000000000000000000000000000', ['0', ethers.utils.parseUnits('10000000000', 17)], BEAN_3CRV, false, false);
      expect((await this.bean3crv.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('0');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('1000000000000000000000000000');
    });
    it("removes liquidity to BEAN:3CRV BEAN token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityImbalanceCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 5), '0'], BEAN_3CRV, false, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.bean3crv.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('0');
    });
  });
});
describe("Internal Balances", function () {
  describe("Add Liquidity -> BEAN:LUSD", async function () {
    it("adds liquidity to BEAN:LUSD two tokens", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_LUSD, true, true);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-10000000000000000');
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('-10000000000000000000000000000')
    });
    it("adds liquidity to BEAN:LUSD LUSD token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve(['0', ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_LUSD, true, true);
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('-10000000000000000000000000000')
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('0');
    });
    it("adds liquidity to BEAN:LUSD BEAN token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), '0'], 1, BEAN_LUSD, true, true);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-10000000000000000');
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('0');
    });
  });
  describe("Add Liquidity -> BEAN:3CRV", async function () {
    it("adds liquidity to BEAN:3CRV both tokens", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_3CRV, true, true);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-10000000000000000');
      expect((await this.bean3crv.balanceOf(userAddress)).sub(this.preLP)).to.eq('10000000000000000000000000000');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('-10000000000000000000000000000');
    });
    it("adds liquidity to BEAN:3CRV 3CRV token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve(['0', ethers.utils.parseUnits('10000000000', 18)], 1, BEAN_3CRV, true, true);
      expect((await this.bean3crv.balanceOf(userAddress)).sub(this.preLP)).to.eq('10000000000000000000000000000');
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('0');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('-10000000000000000000000000000');
    });
    it("adds liquidity to BEAN:3CRV BEAN token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).addLiquidityCurve([ethers.utils.parseUnits('10000000000', 6), '0'], 1, BEAN_3CRV, true, true);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-10000000000000000');
      expect((await this.bean3crv.balanceOf(userAddress)).sub(this.preLP)).to.eq('10000000000000000000000000000');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('0');
    });
  });
  describe("Swap -> BEAN:LUSD", async function () {
    it("swaps from BEAN -> LUSD", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 6), ethers.utils.parseUnits('90', 18), 0, 1, BEAN_LUSD, true, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-1000000000');
    });
    it("swaps from LUSD -> BEAN", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 18), ethers.utils.parseUnits('90', 6), 1, 0, BEAN_LUSD, true, false); 
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('-1000000000000000000000');
    });
  });
  describe("Swap -> BEAN:3CRV", async function () {
    it("swaps from BEAN -> 3CRV", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 6), ethers.utils.parseUnits('90', 18), 0, 1, BEAN_3CRV, false, true);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('-1000000000');
    });
    it("swaps from 3CRV -> BEAN", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).swapOnCurve(ethers.utils.parseUnits('1000', 18), ethers.utils.parseUnits('90', 6), 1, 0, BEAN_3CRV, false, true); 
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('-1000000000000000000000');
    });
  });
  describe("Remove Liquidity -> BEAN:LUSD", async function () {
    it("removes liquidity to BEAN:LUSD two tokens", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 5), ethers.utils.parseUnits('10000000000', 17)], BEAN_LUSD, false, true);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('1000000000000000000000000000')
    });
    it("removes liquidity to BEAN:LUSD LUSD token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityImbalanceCurve('10000000000000000000000000000', ['0', ethers.utils.parseUnits('10000000000', 17)], BEAN_LUSD, false, true);
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('1000000000000000000000000000')
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('0');
    });
    it("removes liquidity to BEAN:LUSD BEAN token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.beanLusd.balanceOf(userAddress);
      this.preLusd = await this.lusd.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityImbalanceCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 5), '0'], BEAN_LUSD, false, true);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.beanLusd.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.lusd.balanceOf(userAddress)).sub(this.preLusd)).to.eq('0');
    });
  });
  describe("Remove Liquidity -> BEAN:3CRV", async function () {
    it("removes liquidity to BEAN:3CRV both tokens", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 5), ethers.utils.parseUnits('10000000000', 17)], BEAN_3CRV, true, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.bean3crv.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('1000000000000000000000000000');
    });
    it("removes liquidity to BEAN:3CRV 3CRV token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityImbalanceCurve('10000000000000000000000000000', ['0', ethers.utils.parseUnits('10000000000', 17)], BEAN_3CRV, true, false);
      expect((await this.bean3crv.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('0');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('1000000000000000000000000000');
    });
    it("removes liquidity to BEAN:3CRV BEAN token only", async function () {
      this.preBean = await this.bean.balanceOf(userAddress);
      this.preLP = await this.bean3crv.balanceOf(userAddress);
      this.pre3Crv = await this.threecurve.balanceOf(userAddress);
      await this.curve.connect(user).removeLiquidityImbalanceCurve('10000000000000000000000000000', [ethers.utils.parseUnits('10000000000', 5), '0'], BEAN_3CRV, true, false);
      expect((await this.bean.balanceOf(userAddress)).sub(this.preBean)).to.eq('1000000000000000');
      expect((await this.bean3crv.balanceOf(userAddress)).sub(this.preLP)).to.eq('-10000000000000000000000000000');
      expect((await this.threecurve.balanceOf(userAddress)).sub(this.pre3Crv)).to.eq('0');
    });
  });
});
});
