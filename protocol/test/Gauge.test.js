const { expect } = require('chai')
const { deploy } = require('../scripts/deploy.js')
const { takeSnapshot, revertToSnapshot } = require("./utils/snapshot")
const { to6, toStalk, toBean, to18 } = require('./utils/helpers.js');
const { USDC, UNRIPE_BEAN, UNRIPE_LP, BEAN,ETH_USDC_UNISWAP_V3, BASE_FEE_CONTRACT, THREE_CURVE, THREE_POOL, BEAN_3_CURVE, BEAN_ETH_WELL } = require('./utils/constants.js');
const { EXTERNAL, INTERNAL } = require('./utils/balances.js');
const { ethers } = require('hardhat');
const { advanceTime } = require('../utils/helpers.js');
const { deployMockWell } = require('../utils/well.js');
const ZERO_BYTES = ethers.utils.formatBytes32String('0x0')

let user, user2, owner;
let userAddress, ownerAddress, user2Address;

async function setToSecondsAfterHour(seconds = 0) {
  const lastTimestamp = (await ethers.provider.getBlock('latest')).timestamp;
  const hourTimestamp = parseInt(lastTimestamp/3600 + 1) * 3600 + seconds
  await network.provider.send("evm_setNextBlockTimestamp", [hourTimestamp])
}


describe('Gauge', function () {
  before(async function () {
    [owner, user] = await ethers.getSigners()
    userAddress = user.address;
    const contracts = await deploy("Test", false, true)
    ownerAddress = contracts.account;
    this.diamond = contracts.beanstalkDiamond;
    this.silo = await ethers.getContractAt('MockSiloFacet', this.diamond.address)
    this.field = await ethers.getContractAt('MockFieldFacet', this.diamond.address)
    this.season = await ethers.getContractAt('MockSeasonFacet', this.diamond.address)
    this.seasonGetter = await ethers.getContractAt('SeasonGetterFacet', this.diamond.address)
    this.unripe = await ethers.getContractAt('MockUnripeFacet', this.diamond.address)
    this.fertilizer = await ethers.getContractAt('MockFertilizerFacet', this.diamond.address)
  
    // These are needed for sunrise incentive test  
    this.bean = await ethers.getContractAt('MockToken', BEAN);
    this.threeCurve = await ethers.getContractAt('MockToken', THREE_CURVE);
    this.threePool = await ethers.getContractAt('Mock3Curve', THREE_POOL);
    await this.threePool.set_virtual_price(to18('1'));
    this.beanThreeCurve = await ethers.getContractAt('MockMeta3Curve', BEAN_3_CURVE);
    await this.beanThreeCurve.set_supply(toBean('100000'));
    // bean3crv set at parity, 10,000 on each side.
    await this.beanThreeCurve.set_balances([toBean('10000'), to18('10000')]);
    await this.beanThreeCurve.reset_cumulative();

    // add unripe
    this.unripeBean = await ethers.getContractAt('MockToken', UNRIPE_BEAN)
    this.unripeLP = await ethers.getContractAt('MockToken', UNRIPE_LP)
    await this.unripeLP.mint(userAddress, to6('1000'))
    await this.unripeBean.mint(userAddress, to6('1000'))
    await this.unripe.addUnripeToken(UNRIPE_BEAN, BEAN, ZERO_BYTES)
    await this.unripe.addUnripeToken(UNRIPE_LP, BEAN_ETH_WELL, ZERO_BYTES);

    [this.well, this.wellFunction, this.pump] = await deployMockWell()
    await this.well.setReserves([to6('1000000'), to18('1000')])
    await advanceTime(3600)
    await owner.sendTransaction({to: user.address, value: 0});
    await setToSecondsAfterHour(0)
    await owner.sendTransaction({to: user.address, value: 0});
    await this.well.connect(user).mint(user.address, to18('1000'))
    await this.season.siloSunrise(0)
  })

  beforeEach(async function () {
    snapshotId = await takeSnapshot()
  })

  afterEach(async function () {
    await revertToSnapshot(snapshotId)
  })

  describe('Percent new grown stalk to LP', function () {
    // MockInitDiamond initalizes percentOfNewGrownStalkToLP to 50% (50e6)

    describe('L2SR > 75%', function () {
      it("increases Percent to LP significantly", async function () {
        this.result = await this.season.seedGaugeSunSunrise('0', 96);
        expect(await this.seasonGetter.getPercentOfNewGrownStalkToLP()).to.be.equal('49500000');
        await expect(this.result).to.emit(this.season, 'GrownStalkToLPChange')
          .withArgs(
            3,     // season
            96,    // caseId
            10000, // relative change (100% of original) 
            -50    // absolute change (-0.5%)
          );
      })
    });

    describe('50% < L2SR < 75%', function () {
      it("increases Percent to LP moderately", async function () {
        this.result = await this.season.seedGaugeSunSunrise('0', 64);
        expect(await this.seasonGetter.getPercentOfNewGrownStalkToLP()).to.be.equal('49750000');
        await expect(this.result).to.emit(this.season, 'GrownStalkToLPChange')
          .withArgs(
            3, // season
            64, // caseId
            10000, // relative multiplier 
            -25 // absolute change (-0.5%)
          );
      })
    });

    describe('25% < L2SR < 50%', function () {
      it("decreases Percent to LP moderately", async function () {
        this.result = await this.season.seedGaugeSunSunrise('0', 32);
        expect(await this.seasonGetter.getPercentOfNewGrownStalkToLP()).to.be.equal('50250000');
        await expect(this.result).to.emit(this.season, 'GrownStalkToLPChange')
          .withArgs(
            3, // season
            32, // caseId
            10000, // relative multiplier 
            25 // absolute change (-0.5%)
          );
      })
    });

    describe('L2SR < 25%', function () {
      it("increases Percent to LP significantly", async function () {
        this.result = await this.season.seedGaugeSunSunrise('0', 0);
        expect(await this.seasonGetter.getPercentOfNewGrownStalkToLP()).to.be.equal('50500000');
        await expect(this.result).to.emit(this.season, 'GrownStalkToLPChange')
          .withArgs(
            3, // season
            0, // caseId
            10000, // relative multiplier 
            50 // absolute change (-0.5%)
          );
      })
    });

    it("cannot go under 0%", async function () {
      await this.season.setPercentOfNewGrownStalkToLP(0.4e6);
      this.result = await this.season.seedGaugeSunSunrise('0', 96);
      expect(await this.seasonGetter.getPercentOfNewGrownStalkToLP()).to.be.equal('0');
      await expect(this.result).to.emit(this.season, 'GrownStalkToLPChange')
        .withArgs(
          3,     // season
          96,    // caseId
          10000, // relative change (100% of original) 
          -40    // absolute change (-0.4%)
        );
    })

    it("cannot go above 100%", async function () {
      await this.season.setPercentOfNewGrownStalkToLP(99.9e6);
      this.result = await this.season.seedGaugeSunSunrise('0', 0);
      expect(await this.seasonGetter.getPercentOfNewGrownStalkToLP()).to.be.equal(to6('100'));
      await expect(this.result).to.emit(this.season, 'GrownStalkToLPChange')
        .withArgs(
          3,     // season
          0,    // caseId
          10000, // relative change (100% of original) 
          10    // absolute change (+0.1%)
        );
    })

  })

  describe('L2SR calculation', function () {
    describe("getter", function () {

      it('returns 0 if no liquidity', async function () {
        await this.bean.mint(userAddress, to6('1000'));
        expect(await this.seasonGetter.getLiquidityToSupplyRatio()).to.be.equal(0);
      })

      it('returns 0 if no supply', async function () {
        this.beanSupply = await this.bean.totalSupply();
        this.result = await this.seasonGetter.getLiquidityToSupplyRatio();
        await expect(this.beanSupply).to.be.equal(0);
        await expect(this.result).to.be.equal(0);
      })      
    }) 
  })
  
  
})