const { expect } = require('chai');
const { deploy } = require('../scripts/deploy.js')
let user,user2,owner;
let userAddress, ownerAddress, user2Address;

const THREE_CURVE = "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7";
const BEAN_3_CURVE = "0x3a70DfA7d2262988064A2D051dd47521E43c9BdD";
const UNISWAP_V2_BEAN_ETH = "0x87898263B6C5BABe34b4ec53F22d98430b91e371";

const BN_ZERO = ethers.utils.parseEther('0');

let lastTimestamp;
let timestamp;

function to18(amount) {
  return ethers.utils.parseEther(amount);
}

function toBean(amount) {
  return ethers.utils.parseUnits(amount, 6);
}

async function resetTime() {
  timestamp = lastTimestamp + 100000000
  lastTimestamp = timestamp
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp],
  });
}

async function advanceTime(time) {
  timestamp += time
  await hre.network.provider.request({
    method: "evm_setNextBlockTimestamp",
    params: [timestamp],
  });
}

describe('Oracle', function () {
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
    this.silo2 = await ethers.getContractAt('MockSiloV2Facet', this.diamond.address);
    this.convert = await ethers.getContractAt('ConvertFacet', this.diamond.address);
    this.pair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pair);
    this.pegPair = await ethers.getContractAt('MockUniswapV2Pair', contracts.pegPair);
    this.bean = await ethers.getContractAt('MockToken', contracts.bean);
    this.claim = await ethers.getContractAt('MockClaimFacet', this.diamond.address)
    this.oracle = await ethers.getContractAt('MockOracleFacet', this.diamond.address)

    await this.pair.simulateTrade(toBean('2000'), to18('2'));
    await this.pegPair.simulateTrade(toBean('2000'), to18('2'));
    await this.season.siloSunrise(0);
    await this.pair.faucet(userAddress, '1');
    await this.bean.mint(userAddress, '1000000000');
    await this.bean.mint(user2Address, '1000000000');
    await this.pair.connect(user).approve(this.silo.address, '100000000000');
    await this.pair.connect(user2).approve(this.silo.address, '100000000000');
    await this.bean.connect(user).approve(this.silo.address, '100000000000');
    await this.bean.connect(user2).approve(this.silo.address, '100000000000');

    lastTimestamp = 1700000000;


    this.threeCurve = await ethers.getContractAt('Mock3Curve', THREE_CURVE);
    await this.threeCurve.set_virtual_price(to18('1'));
    this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
    await this.beanThreeCurve.set_supply('100000');
    await this.beanThreeCurve.set_A_precise('1000');
    await this.beanThreeCurve.set_balances([toBean('1000000'), to18('1000000')]);
  });

  beforeEach (async function () {
    await this.season.resetState();
    await this.pair.burnAllLP(this.season.address);
    await this.beanThreeCurve.set_balances([toBean('1000000'), to18('1000000')]);
    await this.pair.simulateTrade(toBean('2000'), to18('2'));
    await this.pegPair.simulateTrade(toBean('2000'), to18('2'));
    await this.season.siloSunrise(0);
    await this.season.teleportSunrise('250');
    await resetTime();
    await this.oracle.resetPools([this.beanThreeCurve.address, this.pair.address, this.pegPair.address]);
    await resetTime();
    await this.oracle.captureE();
  });
  
  describe("Curve", async function () {
    beforeEach(async function () {
      console.log(await this.season.season());
    })

    it('initializes the oracle', async function () {
      const o = await this.oracle.curveOracle();
      expect(o.initialized).to.equal(true);
      expect(o.balances[0]).to.equal(toBean('100000001000000'));
      expect(o.balances[1]).to.equal(to18('100000001000000'));
      const block = await ethers.provider.getBlock("latest");
      expect(o.timestamp).to.equal(block.timestamp);
    })

    it("tracks a basic TWAL", async function () {
      this.result = await this.oracle.updateTWAPCurveE();
      await expect(this.result).to.emit(this.oracle, 'UpdateTWAPs').withArgs(
        [toBean('1000000'), to18('1000000')]
      )
    });
  
    it("tracks a TWAL with a change", async function () {
      await advanceTime(900)
      await this.beanThreeCurve.update([toBean('2000000'), to18('1000000')])
      await advanceTime(900)
      this.result = await this.oracle.updateTWAPCurveE();
      await expect(this.result).to.emit(this.oracle, 'UpdateTWAPs').withArgs(
        [ethers.utils.parseUnits('1500000', 6), ethers.utils.parseEther('1000000')]
      )
    });
  
    it("2 separate TWAL", async function () {
      await advanceTime(900)
      await this.beanThreeCurve.update([toBean('2000000'), to18('1000000')])
      await advanceTime(900)
      await this.beanThreeCurve.update([toBean('1000000'), to18('1000000')])
      await advanceTime(1800)
      this.result = await this.oracle.updateTWAPCurveE();
      
      await expect(this.result).to.emit(this.oracle, 'UpdateTWAPs').withArgs(
        [ethers.utils.parseUnits('1250000', 6), ethers.utils.parseEther('1000000')]
      )
      await advanceTime(900)
      await this.beanThreeCurve.update([toBean('500000'), to18('1000000')])
      await advanceTime(900)
      this.result = await this.oracle.updateTWAPCurveE();
      
      await expect(this.result).to.emit(this.oracle, 'UpdateTWAPs').withArgs(
        [toBean('750000'), to18('1000000')]
      )
    });

    describe("Delta B", async function () {
      it("tracks a basic Delta B", async function () {
        this.result = await this.oracle.captureCurveE();
        await expect(this.result).to.emit(this.oracle, 'DeltaB').withArgs('0');
      });

      it("tracks a TWAL with a change", async function () {
        await advanceTime(900)
        await this.beanThreeCurve.update([toBean('2000000'), to18('1000000')])
        await advanceTime(900)
        this.result = await this.oracle.captureCurveE();
        await expect(this.result).to.emit(this.oracle, 'DeltaB').withArgs('-252354675068');
      });

      it("tracks a TWAL during ramping up season", async function () {
        await this.season.teleportSunrise('120');
        await resetTime();
        await this.oracle.captureE();
        await advanceTime(900)
        await this.beanThreeCurve.update([toBean('2000000'), to18('1000000')])
        await advanceTime(900)
        this.result = await this.oracle.captureCurveE();
        await expect(this.result).to.emit(this.oracle, 'DeltaB').withArgs('-126177337534')
        this.result = await this.oracle.updateTWAPCurveE();
      });

      it("tracks a TWAL with a change", async function () {
        await advanceTime(900)
        await this.beanThreeCurve.update([toBean('2000000'), to18('1000000')])
        await advanceTime(900)
        this.result = await this.oracle.captureCurveE();
        await expect(this.result).to.emit(this.oracle, 'DeltaB').withArgs('-252354675068');
      });

      it("tracks a TWAL with a change", async function () {
        await advanceTime(1800)
        await this.beanThreeCurve.update([toBean('2000000'), to18('2020000')])
        await advanceTime(900)
        this.result = await this.oracle.captureCurveE();
        await expect(this.result).to.emit(this.oracle, 'DeltaB').withArgs('3332955488');
      });
    });

    describe("Get Delta B", async function () {
      it("tracks a basic Delta B", async function () {
        await advanceTime(900)
        await hre.network.provider.send("evm_mine")
        expect(await this.oracle.poolDeltaB(BEAN_3_CURVE)).to.equal('0');
      });

      it("tracks a TWAL with a change", async function () {
        await advanceTime(900)
        await this.beanThreeCurve.update([toBean('2000000'), to18('1000000')])
        await advanceTime(900)
        await hre.network.provider.send("evm_mine")
        expect(await this.oracle.poolDeltaB(BEAN_3_CURVE)).to.equal('-252354675068');
      });
    });
  });

  describe("Uniswap", async function () {
    it('initializes the oracle', async function () {
      const o = await this.oracle.uniswapOracle();
      expect(o.initialized).to.equal(true);
      const p = (ethers.utils.parseUnits('2', 0).pow(112)).mul(ethers.utils.parseUnits('1',17));
      const p2 = (ethers.utils.parseUnits('2', 0).pow(112)).mul(ethers.utils.parseUnits('1.00001',17));
      expect(o.cumulative).to.within(p, p2);
      expect(o.pegCumulative).to.within(p, p2);
      const block = await ethers.provider.getBlock("latest");
      expect(o.timestamp).to.equal(block.timestamp);
      expect(o.pegTimestamp).to.equal(block.timestamp);
    });

    it("tracks a basic TWAP", async function () {
      await advanceTime(900)
      this.result = await this.oracle.updateTWAPUniswapE();
      await expect(this.result).to.emit(this.oracle, 'UpdateTWAPs').withArgs(
        ['1000000000000000','1000000000000000']
      );
    });

    it("tracks a basic TWAP on pair", async function () {
      await advanceTime(900)
      await this.pair.simulateTrade(toBean('2000'), to18('2.02'));
      await advanceTime(900)
      this.result = await this.oracle.updateTWAPUniswapE();
      await expect(this.result).to.emit(this.oracle, 'UpdateTWAPs').withArgs(
        ['1005000000000000','1000000000000000']
      )
    });

    it("tracks a basic TWAP on peg pair", async function () {
      await advanceTime(900)
      await this.pegPair.simulateTrade(toBean('2000'), to18('2.02'));
      await advanceTime(900)
      this.result = await this.oracle.updateTWAPUniswapE();
      await expect(this.result).to.emit(this.oracle, 'UpdateTWAPs').withArgs(
        ['1000000000000000','1005000000000000']
      )
    });

    it("2 separate TWAPs", async function () {
      await advanceTime(900)
      await this.pair.simulateTrade(toBean('2000'), to18('2.02'));
      await advanceTime(900)
      await this.pegPair.simulateTrade(toBean('2000'), to18('2.02'));
      await advanceTime(900)
      this.result = await this.oracle.updateTWAPUniswapE();
      await expect(this.result).to.emit(this.oracle, 'UpdateTWAPs').withArgs(
        ['1006666666666666', '1003333333333333']
      );

      await advanceTime(900)
      await this.pair.simulateTrade(toBean('2000'), to18('2'));
      await advanceTime(900)
      await this.pegPair.simulateTrade(toBean('2000'), to18('2'));
      await advanceTime(900)
      this.result = await this.oracle.updateTWAPUniswapE();
      await expect(this.result).to.emit(this.oracle, 'UpdateTWAPs').withArgs(
        ['1003333333333333', '1006666666666666']
      )
    });

    describe("Delta B", async function () {
      it("Delta B with no liquidity in Silo", async function () {
        await advanceTime(900)
        await this.pair.simulateTrade(toBean('2000'), to18('2'));
        await advanceTime(900)
        this.result = await this.oracle.captureUniswapE();
        await expect(this.result).to.emit(this.oracle, 'DeltaB').withArgs('0');
      });
  
      it("Delta B with some liquidity in Silo", async function () {
        await this.silo.incrementDepositedLPE('1');
        await advanceTime(900)
        await this.pair.simulateTrade(toBean('2000'), to18('2.02'));
        await advanceTime(900)
        this.result = await this.oracle.captureUniswapE();
        await expect(this.result).to.emit(this.oracle, 'DeltaB').withArgs('2503087');
      });

      it("Delta B with some liquidity in Silo", async function () {
        await this.silo.incrementDepositedLPE('1');
        await advanceTime(900)
        await this.pair.simulateTrade(toBean('2000'), to18('2.02'));
        await advanceTime(1800)
        this.result = await this.oracle.captureUniswapE();
        await expect(this.result).to.emit(this.oracle, 'DeltaB').withArgs('3333302');
      });
    })

    describe("Get Delta B", async function () {
      it("Delta B with no liquidity in Silo", async function () {
        await advanceTime(900)
        await this.pair.simulateTrade(toBean('2000'), to18('2'));
        await advanceTime(900)
        await hre.network.provider.send("evm_mine")
        expect(await this.oracle.poolDeltaB(UNISWAP_V2_BEAN_ETH)).to.equal('0');
      });
  
      it("Delta B with some liquidity in Silo", async function () {
        await this.silo.incrementDepositedLPE('1');
        await advanceTime(900)
        await this.pair.simulateTrade(toBean('2000'), to18('2.02'));
        await advanceTime(900)
        await hre.network.provider.send("evm_mine")
        expect(await this.oracle.poolDeltaB(UNISWAP_V2_BEAN_ETH)).to.equal('2503087');
      });

    })
  });

  describe("Delta B Overall", async function () {
    it("Delta B Overall", async function () {
      await this.silo.incrementDepositedLPE('1');
      await advanceTime(900)
      await this.pair.simulateTrade(toBean('2000'), to18('2.02'));
      await advanceTime(900)
      await this.beanThreeCurve.update([toBean('2000000'), to18('2020000')])
      await advanceTime(900)
      this.result = await this.oracle.captureE();
      await expect(this.result).to.emit(this.oracle, 'DeltaB').withArgs('3336288790');
    });
  })
});